require('dotenv').config();
const pgService = require('../services/postgresql.service');
const SyncQueueWorker = require('../services/sync-queue-worker');
const logger = require('../utils/logger');

/**
 * ÇİFT YÖNLÜ SENKRONIZASYON
 * 
 * Bu script hem ERP -> Web hem de Web -> ERP senkronizasyonunu yapar:
 * 1. ERP -> Web: Tüm master verileri (stok, kategori, fiyat, vb.)
 * 2. Web -> ERP: Bekleyen satış ve tahsilat kayıtları
 */

async function runBidirectionalSync() {
    const startTime = Date.now();

    try {
        console.log('='.repeat(70));
        console.log('ÇİFT YÖNLÜ SENKRONIZASYON BAŞLIYOR');
        console.log('='.repeat(70));
        console.log();

        // 1. ERP -> Web Senkronizasyonu
        console.log('📥 ADIM 1: ERP -> Web Senkronizasyonu');
        console.log('-'.repeat(70));

        const { execSync } = require('child_process');
        try {
            execSync('node scripts/fast_bulk_sync.js', {
                stdio: 'inherit',
                cwd: process.cwd()
            });
            console.log('✓ ERP -> Web senkronizasyonu tamamlandı');
        } catch (error) {
            logger.error('ERP -> Web senkronizasyon hatası:', error);
            throw error;
        }

        console.log();
        console.log('📤 ADIM 2: Web -> ERP Senkronizasyonu');
        console.log('-'.repeat(70));

        // 2. Web -> ERP Senkronizasyonu (Queue Worker)
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
        console.log('✓ ÇİFT YÖNLÜ SENKRONIZASYON TAMAMLANDI!');
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
        // Bağlantıları kapat
        try {
            await pgService.disconnect();
        } catch (e) {
            // Ignore
        }
        process.exit(0);
    }
}

// Script olarak çalıştırıldığında
if (require.main === module) {
    runBidirectionalSync();
}

module.exports = runBidirectionalSync;
