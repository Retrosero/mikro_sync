require('dotenv').config();
const syncService = require('./services/sync.service');
const satisProcessor = require('./sync-jobs/satis.processor');
const tahsilatProcessor = require('./sync-jobs/tahsilat.processor');
const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Logs klasörünü oluştur
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Processor'ları kaydet
const stokProcessor = require('./sync-jobs/stok.processor');
const fiyatProcessor = require('./sync-jobs/fiyat.processor');

// Web → ERP
syncService.registerProcessor('satislar', satisProcessor);
syncService.registerProcessor('satis_kalemleri', satisProcessor);
syncService.registerProcessor('tahsilatlar', tahsilatProcessor);

// ERP → Web
syncService.registerProcessor('STOKLAR', stokProcessor);
syncService.registerProcessor('BARKOD_TANIMLARI', stokProcessor);
syncService.registerProcessor('STOK_SATIS_FIYAT_LISTELERI', fiyatProcessor);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT sinyali alındı, kapatılıyor...');
  syncService.stop();

  // Bağlantıları kapat
  const pgService = require('./services/postgresql.service');
  const mssqlService = require('./services/mssql.service');

  await pgService.disconnect();
  await mssqlService.disconnect();

  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM sinyali alındı, kapatılıyor...');
  syncService.stop();

  const pgService = require('./services/postgresql.service');
  const mssqlService = require('./services/mssql.service');

  await pgService.disconnect();
  await mssqlService.disconnect();

  process.exit(0);
});

// Hata yakalama
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Başlat
async function main() {
  try {
    // Startup banner
    logger.startup();

    logger.info('Sistem başlatılıyor...', { context: 'startup' });

    // Veritabanı bağlantılarını test et
    const pgService = require('./services/postgresql.service');
    const mssqlService = require('./services/mssql.service');

    logger.info('Veritabanı bağlantıları test ediliyor...', { context: 'startup' });

    await pgService.query('SELECT 1');
    logger.info('✓ PostgreSQL bağlantısı başarılı', { context: 'startup' });

    await mssqlService.query('SELECT 1');
    logger.info('✓ MS SQL bağlantısı başarılı', { context: 'startup' });

    // Lookup cache'i yükle
    const lookupTables = require('./mappings/lookup-tables');
    await lookupTables.refreshCache();
    logger.info('✓ Lookup cache yüklendi', {
      context: 'startup',
      cariMappings: lookupTables.cache.cari.size,
      stokMappings: lookupTables.cache.stok.size,
      bankaMappings: lookupTables.cache.banka.size,
      kasaMappings: lookupTables.cache.kasa.size
    });

    // Konfigürasyon bilgileri
    logger.info('Konfigürasyon:', {
      context: 'startup',
      interval: `${process.env.SYNC_INTERVAL_MS}ms`,
      batchSize: process.env.BATCH_SIZE,
      maxRetry: process.env.MAX_RETRY_COUNT,
      logLevel: process.env.LOG_LEVEL || 'info'
    });

    logger.info('Senkronizasyon servisi başlatılıyor...', { context: 'startup' });

    // API Server for Manual Trigger
    const app = express();
    const port = 3001;

    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      next();
    });

    app.post('/api/trigger-sync', (req, res) => {
      const triggered = syncService.triggerSync();
      res.json({ success: true, message: triggered ? 'Senkronizasyon tetiklendi' : 'Senkronizasyon zaten aktif veya başlatılıyor' });
    });

    app.listen(port, () => {
      logger.info(`API sunucusu http://localhost:${port} üzerinde çalışıyor`, { context: 'api' });
    });

    // Dashboard Server'ı Başlat
    const { fork } = require('child_process');
    const dashboardPath = path.join(__dirname, 'dashboard', 'server.js');

    logger.info('Dashboard paneli başlatılıyor...', { context: 'startup' });

    const dashboardProcess = fork(dashboardPath, [], {
      stdio: 'inherit',
      env: { ...process.env, PORT: 3456 }
    });

    dashboardProcess.on('error', (err) => {
      logger.error('Dashboard başlatılamadı:', err);
    });

    // Ana process kapandığında dashboard'u da kapat
    process.on('exit', () => {
      dashboardProcess.kill();
    });

    // Senkronizasyonu başlat
    await syncService.start();
  } catch (error) {
    logger.error('Başlatma hatası', {
      context: 'startup-error',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

main();
