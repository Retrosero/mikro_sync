require('dotenv').config();
const SyncQueueWorker = require('./services/sync-queue-worker');
const logger = require('./utils/logger');

/**
 * SADECE WEB -> ERP SENKRONIZASYONU
 */

async function runWebToErpSync() {
    const startTime = Date.now();

    try {
        console.log('='.repeat(70));
        console.log('WEB -> ERP SENKRONIZASYONU BAŞLIYOR');
        console.log('='.repeat(70));
        console.log();

        // Web -> ERP Senkronizasyonu (Queue Worker)
        const worker = new SyncQueueWorker();

        // Queue'daki bekleyen kayıtları işle
        await worker.processQueue();

        // İstatistikleri göster
        const stats = await worker.getQueueStats();
        console.log('Queue İstatistikleri:');
        console.log(`  - Bekleyen: ${stats.pending || 0}`);
        console.log(`  - İşleniyor: ${stats.processing || 0}`);
        console.log(`  - Tamamlanan: ${stats.completed || 0}`);
        console.log(`  - Başarısız: ${stats.failed || 0}`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log();
        console.log('='.repeat(70));
        console.log('✓ WEB -> ERP SENKRONIZASYONU TAMAMLANDI!');
        console.log(`Toplam Süre: ${duration} saniye`);
        console.log('='.repeat(70));

    } catch (error) {
        console.error();
        console.error('='.repeat(70));
        console.error('✗ SENKRONIZASYON BAŞARISIZ!');
        console.error('='.repeat(70));
        console.error('Hata:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    } finally {
        process.exit(0);
    }
}

runWebToErpSync();
