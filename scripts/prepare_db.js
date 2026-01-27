const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

async function fixPostgreSQL() {
  logger.info('PostgreSQL düzeltmeleri başlatılıyor...');
  try {
    // 1. sync_logs tablosunda direction sütununu kontrol et
    const columns = await pgService.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sync_logs' AND column_name = 'direction'
    `);

    if (columns.length === 0) {
      logger.info('PostgreSQL: sync_logs tablosuna direction sütunu ekleniyor...');
      await pgService.query('ALTER TABLE sync_logs ADD COLUMN direction TEXT NOT NULL DEFAULT \'UNKNOWN\'');
      logger.info('PostgreSQL: direction sütunu başarıyla eklendi.');
    } else {
      logger.info('PostgreSQL: sync_logs.direction sütunu zaten mevcut.');
    }

    // 2. sync_queue'daki null source_table kayıtlarını temizle
    const nullItems = await pgService.query('SELECT count(*) as count FROM sync_queue WHERE source_table IS NULL');
    if (parseInt(nullItems[0].count) > 0) {
      logger.warn(`PostgreSQL: sync_queue tablosunda ${nullItems[0].count} adet null source_table kaydı bulundu. Temizleniyor...`);
      await pgService.query('DELETE FROM sync_queue WHERE source_table IS NULL');
      logger.info('PostgreSQL: Hatalı kayıtlar temizlendi.');
    }

  } catch (error) {
    logger.error('PostgreSQL düzeltme hatası:', error);
  }
}

async function fixMSSQL() {
  logger.info('MS SQL düzeltmeleri başlatılıyor...');
  try {
    // 1. SYNC_QUEUE tablosunu kontrol et
    const queueExists = await mssqlService.query(`
      SELECT * FROM sys.tables WHERE name = 'SYNC_QUEUE'
    `);

    if (queueExists.length === 0) {
      logger.info('MS SQL: SYNC_QUEUE tablosu oluşturuluyor...');
      await mssqlService.query(`
        CREATE TABLE SYNC_QUEUE (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          source_table NVARCHAR(100) NOT NULL,
          operation NVARCHAR(20) NOT NULL,
          record_id NVARCHAR(100) NOT NULL,
          record_data NVARCHAR(MAX),
          priority INT DEFAULT 5,
          status NVARCHAR(20) DEFAULT 'pending',
          retry_count INT DEFAULT 0,
          error_message NVARCHAR(MAX),
          created_at DATETIME DEFAULT GETDATE(),
          processed_at DATETIME
        );
        CREATE INDEX idx_sync_queue_status ON SYNC_QUEUE(status, priority, created_at);
        CREATE INDEX idx_sync_queue_table ON SYNC_QUEUE(source_table);
      `);
      logger.info('MS SQL: SYNC_QUEUE tablosu başarıyla oluşturuldu.');
    } else {
      logger.info('MS SQL: SYNC_QUEUE tablosu zaten mevcut.');
    }

    // 2. SYNC_LOGS tablosunu kontrol et
    const logsExists = await mssqlService.query(`
      SELECT * FROM sys.tables WHERE name = 'SYNC_LOGS'
    `);

    if (logsExists.length === 0) {
      logger.info('MS SQL: SYNC_LOGS tablosu oluşturuluyor...');
      await mssqlService.query(`
        CREATE TABLE SYNC_LOGS (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          direction NVARCHAR(20) NOT NULL,
          entity NVARCHAR(100) NOT NULL,
          operation NVARCHAR(20) NOT NULL,
          record_id NVARCHAR(100),
          status NVARCHAR(20) NOT NULL,
          error_message NVARCHAR(MAX),
          duration_ms INT,
          created_at DATETIME DEFAULT GETDATE()
        );
        CREATE INDEX idx_sync_logs_date ON SYNC_LOGS(created_at);
      `);
      logger.info('MS SQL: SYNC_LOGS tablosu başarıyla oluşturuldu.');
    } else {
      logger.info('MS SQL: SYNC_LOGS tablosu zaten mevcut.');
    }

    // 3. Null source_table kayıtlarını temizle
    const nullItems = await mssqlService.query('SELECT count(*) as count FROM SYNC_QUEUE WHERE source_table IS NULL');
    if (nullItems.length > 0 && nullItems[0].count > 0) {
       logger.warn(`MS SQL: SYNC_QUEUE tablosunda ${nullItems[0].count} adet null source_table kaydı bulundu. Temizleniyor...`);
       await mssqlService.query('DELETE FROM SYNC_QUEUE WHERE source_table IS NULL');
       logger.info('MS SQL: Hatalı kayıtlar temizlendi.');
    }

  } catch (error) {
    logger.error('MS SQL düzeltme hatası:', error);
  }
}

async function run() {
  await fixPostgreSQL();
  await fixMSSQL();
  logger.info('Düzeltme işlemi tamamlandı. Servisleri yeniden başlatabilirsiniz.');
  process.exit(0);
}

run();
