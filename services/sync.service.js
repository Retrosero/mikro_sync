const pgService = require('./postgresql.service');
const mssqlService = require('./mssql.service');
const logger = require('../utils/logger');
const { handleError, isRetryable } = require('../utils/error-handler');
const config = require('../config/sync.config');

class SyncService {
  constructor() {
    this.isRunning = false;
    this.processors = new Map();
  }

  // Processor kaydet
  registerProcessor(tableName, processor) {
    this.processors.set(tableName, processor);
    logger.info(`Processor kaydedildi: ${tableName}`);
  }

  // Ana senkronizasyon döngüsü
  async start() {
    if (this.isRunning) {
      logger.warn('Senkronizasyon zaten çalışıyor');
      return;
    }

    this.isRunning = true;
    logger.info('Senkronizasyon servisi başlatıldı');

    while (this.isRunning) {
      try {
        // PostgreSQL queue'dan işle
        await this.processPostgreSQLQueue();
        
        // MS SQL queue'dan işle
        await this.processMSSQLQueue();
        
        // Bekle
        await this.sleep(config.syncIntervalMs);
      } catch (error) {
        logger.error('Senkronizasyon döngüsü hatası:', error);
        await this.sleep(5000); // Hata durumunda 5 saniye bekle
      }
    }
  }

  stop() {
    this.isRunning = false;
    logger.info('Senkronizasyon servisi durduruluyor...');
  }

  // PostgreSQL Queue İşleme (Web → ERP)
  async processPostgreSQLQueue() {
    try {
      const queueItems = await pgService.query(
        `SELECT * FROM sync_queue 
         WHERE status = 'pending' 
         ORDER BY priority ASC, created_at ASC 
         LIMIT $1`,
        [config.batchSize]
      );

      if (queueItems.length === 0) {
        return;
      }

      logger.info(`PostgreSQL queue: ${queueItems.length} kayıt işlenecek`);

      for (const item of queueItems) {
        await this.processQueueItem(item, 'WEB_TO_ERP');
      }
    } catch (error) {
      logger.error('PostgreSQL queue işleme hatası:', error);
    }
  }

  // MS SQL Queue İşleme (ERP → Web)
  async processMSSQLQueue() {
    try {
      const queueItems = await mssqlService.query(
        `SELECT TOP ${config.batchSize} * FROM SYNC_QUEUE 
         WHERE status = 'pending' 
         ORDER BY priority ASC, created_at ASC`
      );

      if (queueItems.length === 0) {
        return;
      }

      logger.info(`MS SQL queue: ${queueItems.length} kayıt işlenecek`);

      for (const item of queueItems) {
        await this.processQueueItem(item, 'ERP_TO_WEB');
      }
    } catch (error) {
      logger.error('MS SQL queue işleme hatası:', error);
    }
  }

  // Tek bir queue kaydını işle
  async processQueueItem(item, direction) {
    const startTime = Date.now();
    const isPostgres = direction === 'WEB_TO_ERP';
    const dbService = isPostgres ? pgService : mssqlService;

    // Başlangıç logu
    logger.syncStart(item.source_table, item.record_id, item.operation);

    try {
      // İşleniyor olarak işaretle
      await this.updateQueueStatus(item.id, 'processing', direction);

      // Processor bul
      const processor = this.processors.get(item.source_table);
      if (!processor) {
        throw new Error(`Processor bulunamadı: ${item.source_table}`);
      }

      // İşle
      const recordData = isPostgres ? item.record_data : JSON.parse(item.record_data);
      await processor.process(recordData, item.operation);

      // Başarılı olarak işaretle
      await this.updateQueueStatus(item.id, 'completed', direction);

      const duration = Date.now() - startTime;

      // Log kaydet
      await this.logSync(direction, item.source_table, item.operation, item.record_id, 'SUCCESS', null, duration);

      // Başarı logu
      logger.syncSuccess(item.source_table, item.record_id, item.operation, duration);

      // Performans uyarısı
      if (duration > 5000) {
        logger.performance('sync-item', duration, {
          table: item.source_table,
          recordId: item.record_id,
          warning: 'İşlem 5 saniyeden uzun sürdü'
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Detaylı hata logu
      logger.syncError(item.source_table, item.record_id, item.operation, error, {
        direction,
        retryCount: item.retry_count,
        queueId: item.id,
        recordData: isPostgres ? item.record_data : JSON.parse(item.record_data)
      });

      // Retry kontrolü
      if (isRetryable(error) && item.retry_count < config.maxRetryCount) {
        await this.updateQueueStatus(item.id, 'pending', direction, error.message, item.retry_count + 1);
        logger.warn(`Retry planlandı: ${item.source_table} - ${item.record_id} (${item.retry_count + 1}/${config.maxRetryCount})`, {
          context: 'retry',
          table: item.source_table,
          recordId: item.record_id,
          retryCount: item.retry_count + 1
        });
      } else {
        await this.updateQueueStatus(item.id, 'failed', direction, error.message);
        logger.error(`İşlem başarısız (retry limiti aşıldı): ${item.source_table} - ${item.record_id}`, {
          context: 'failed',
          table: item.source_table,
          recordId: item.record_id,
          retryCount: item.retry_count,
          error: error.message
        });
      }

      // Log kaydet
      await this.logSync(direction, item.source_table, item.operation, item.record_id, 'FAILED', error.message, duration);
    }
  }

  // Queue durumunu güncelle
  async updateQueueStatus(id, status, direction, errorMessage = null, retryCount = null) {
    const isPostgres = direction === 'WEB_TO_ERP';

    if (isPostgres) {
      const updates = ['status = $2'];
      const params = [id, status];
      let paramIndex = 3;

      if (status === 'completed' || status === 'failed') {
        updates.push(`processed_at = NOW()`);
      }

      if (errorMessage) {
        updates.push(`error_message = $${paramIndex++}`);
        params.push(errorMessage);
      }

      if (retryCount !== null) {
        updates.push(`retry_count = $${paramIndex++}`);
        params.push(retryCount);
      }

      await pgService.query(
        `UPDATE sync_queue SET ${updates.join(', ')} WHERE id = $1`,
        params
      );
    } else {
      const updates = ['status = @status'];
      const params = { id, status };

      if (status === 'completed' || status === 'failed') {
        updates.push('processed_at = GETDATE()');
      }

      if (errorMessage) {
        updates.push('error_message = @errorMessage');
        params.errorMessage = errorMessage;
      }

      if (retryCount !== null) {
        updates.push('retry_count = @retryCount');
        params.retryCount = retryCount;
      }

      await mssqlService.query(
        `UPDATE SYNC_QUEUE SET ${updates.join(', ')} WHERE id = @id`,
        params
      );
    }
  }

  // Sync log kaydet
  async logSync(direction, entity, operation, recordId, status, errorMessage, durationMs) {
    try {
      await pgService.query(
        `INSERT INTO sync_logs (direction, entity, operation, record_id, status, error_message, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [direction, entity, operation, recordId, status, errorMessage, durationMs]
      );
    } catch (error) {
      logger.error('Log kaydetme hatası:', error);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SyncService();
