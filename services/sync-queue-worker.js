require('dotenv').config();
const pgService = require('../services/postgresql.service');
const satisProcessor = require('../sync-jobs/satis.processor');
const tahsilatProcessor = require('../sync-jobs/tahsilat.processor');
const logger = require('../utils/logger');

class SyncQueueWorker {
    constructor() {
        this.isRunning = false;
        this.pollInterval = 5000; // 5 saniye
        this.maxRetries = 3;
    }

    async start() {
        if (this.isRunning) {
            logger.warn('Sync queue worker zaten çalışıyor');
            return;
        }

        this.isRunning = true;
        logger.info('Sync queue worker başlatıldı');

        // İlk çalıştırma
        await this.processQueue();

        // Periyodik çalıştırma
        this.intervalId = setInterval(async () => {
            await this.processQueue();
        }, this.pollInterval);
    }

    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('Sync queue worker durduruldu');
    }

    async processQueue() {
        try {
            // Bekleyen kayıtları al (en eski önce)
            const pendingItems = await pgService.query(`
        SELECT id, entity_type, entity_id, operation, retry_count
        FROM sync_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 10
      `);

            if (pendingItems.length === 0) {
                return;
            }

            logger.info(`${pendingItems.length} bekleyen sync kaydı işleniyor...`);

            for (const item of pendingItems) {
                await this.processItem(item);
            }

        } catch (error) {
            logger.error('Queue işleme hatası:', error);
        }
    }

    async processItem(item) {
        try {
            // Durumu processing yap
            await pgService.query(
                `UPDATE sync_queue SET status = 'processing' WHERE id = $1`,
                [item.id]
            );

            // Entity verisini çek
            let entityData = null;

            if (item.entity_type === 'satis') {
                // Satış verilerini çek (satış kalemleri ile birlikte)
                const satis = await pgService.query(
                    `SELECT * FROM satislar WHERE id = $1`,
                    [item.entity_id]
                );

                if (satis.length === 0) {
                    throw new Error(`Satış bulunamadı: ${item.entity_id}`);
                }

                entityData = satis[0];

                // Processor'a gönder
                await satisProcessor.syncToERP(entityData);

            } else if (item.entity_type === 'tahsilat') {
                // Tahsilat verilerini çek
                const tahsilat = await pgService.query(
                    `SELECT * FROM tahsilatlar WHERE id = $1`,
                    [item.entity_id]
                );

                if (tahsilat.length === 0) {
                    throw new Error(`Tahsilat bulunamadı: ${item.entity_id}`);
                }

                entityData = tahsilat[0];

                // Processor'a gönder
                await tahsilatProcessor.syncToERP(entityData);

            } else if (item.entity_type === 'alis') {
                // Alış verilerini çek
                const alis = await pgService.query(
                    `SELECT * FROM alislar WHERE id = $1`,
                    [item.entity_id]
                );

                if (alis.length === 0) {
                    throw new Error(`Alış bulunamadı: ${item.entity_id}`);
                }

                entityData = alis[0];

                // Processor'a gönder
                const alisProcessor = require('../sync-jobs/alis.processor');
                await alisProcessor.syncToERP(entityData);

            } else {
                throw new Error(`Bilinmeyen entity tipi: ${item.entity_type}`);
            }

            // Başarılı - durumu güncelle
            await pgService.query(
                `UPDATE sync_queue 
         SET status = 'completed', 
             processed_at = NOW(),
             error_message = NULL
         WHERE id = $1`,
                [item.id]
            );

            logger.info(`✓ ${item.entity_type} senkronize edildi: ${item.entity_id}`);

        } catch (error) {
            logger.error(`✗ ${item.entity_type} senkronizasyon hatası:`, error);

            // Retry sayısını artır
            const newRetryCount = item.retry_count + 1;

            if (newRetryCount >= this.maxRetries) {
                // Max retry'a ulaşıldı - failed yap
                await pgService.query(
                    `UPDATE sync_queue 
           SET status = 'failed', 
               retry_count = $1,
               error_message = $2,
               processed_at = NOW()
           WHERE id = $3`,
                    [newRetryCount, error.message, item.id]
                );
                logger.error(`✗ ${item.entity_type} max retry'a ulaştı: ${item.entity_id}`);
            } else {
                // Tekrar dene - pending'e geri al
                await pgService.query(
                    `UPDATE sync_queue 
           SET status = 'pending', 
               retry_count = $1,
               error_message = $2
           WHERE id = $3`,
                    [newRetryCount, error.message, item.id]
                );
                logger.warn(`⚠ ${item.entity_type} tekrar denenecek (${newRetryCount}/${this.maxRetries}): ${item.entity_id}`);
            }
        }
    }

    async getQueueStats() {
        const stats = await pgService.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM sync_queue
      GROUP BY status
    `);

        return stats.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
        }, {});
    }
}

// Standalone çalıştırma
if (require.main === module) {
    const worker = new SyncQueueWorker();

    // Graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('SIGINT alındı, worker durduruluyor...');
        await worker.stop();
        await pgService.disconnect();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('SIGTERM alındı, worker durduruluyor...');
        await worker.stop();
        await pgService.disconnect();
        process.exit(0);
    });

    // Worker'ı başlat
    worker.start().catch(error => {
        logger.error('Worker başlatma hatası:', error);
        process.exit(1);
    });

    // Her 30 saniyede bir istatistik göster
    setInterval(async () => {
        const stats = await worker.getQueueStats();
        logger.info('Queue İstatistikleri:', stats);
    }, 30000);
}

module.exports = SyncQueueWorker;
