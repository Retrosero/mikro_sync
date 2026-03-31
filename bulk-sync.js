/**
 * Bulk ERP → Web Senkronizasyonu
 * Stok hareketleri ve Cari hareketleri dahil tüm verileri senkronize eder
 */

require('dotenv').config();
const stokProcessor = require('./sync-jobs/stok.processor');
const stokHareketProcessor = require('./sync-jobs/stok-hareket.processor');
const fiyatProcessor = require('./sync-jobs/fiyat.processor');
const cariProcessor = require('./sync-jobs/cari.processor');
const cariHareketProcessor = require('./sync-jobs/cari-hareket.processor');
const logger = require('./utils/logger');
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function runBulkSync() {
    try {
        console.log('='.repeat(70));
        console.log('BULK ERP → Web SENKRONIZASYONU');
        console.log('='.repeat(70));
        console.log();

        const startTime = Date.now();

        // Bağlantı testi
        console.log('Veritabanı bağlantıları test ediliyor...');
        await pgService.query('SELECT 1');
        console.log('✓ PostgreSQL bağlantısı başarılı');

        await mssqlService.query('SELECT 1');
        console.log('✓ MS SQL bağlantısı başarılı');
        console.log();

        // 1. STOK SENKRONIZASYONU
        console.log('1. STOK SENKRONIZASYONU...');
        const stokStartTime = Date.now();
        const stokCount = await stokProcessor.syncToWeb(null);
        console.log(`✓ Stok: ${stokCount} kayıt (${((Date.now() - stokStartTime) / 1000).toFixed(2)}s)`);
        console.log();

        // 2. BARKOD SENKRONIZASYONU
        console.log('2. BARKOD SENKRONIZASYONU...');
        const barkodStartTime = Date.now();
        const barkodCount = await stokProcessor.syncBarkodlarIncremental(null);
        console.log(`✓ Barkod: ${barkodCount} kayıt (${((Date.now() - barkodStartTime) / 1000).toFixed(2)}s)`);
        console.log();

        // 3. FİYAT SENKRONIZASYONU
        console.log('3. FİYAT SENKRONIZASYONU...');
        const fiyatStartTime = Date.now();
        const fiyatCount = await fiyatProcessor.syncToWeb(null);
        console.log(`✓ Fiyat: ${fiyatCount} kayıt (${((Date.now() - fiyatStartTime) / 1000).toFixed(2)}s)`);
        console.log();

        // 4. CARI SENKRONIZASYONU
        console.log('4. CARI SENKRONIZASYONU...');
        const cariStartTime = Date.now();
        const cariCount = await cariProcessor.syncToWeb(null);
        console.log(`✓ Cari: ${cariCount} kayıt (${((Date.now() - cariStartTime) / 1000).toFixed(2)}s)`);
        console.log();

        // 5. STOK HAREKETLERI SENKRONIZASYONU (TAM)
        console.log('5. STOK HAREKETLERI SENKRONIZASYONU (TAM)...');
        const stokHareketStartTime = Date.now();
        const stokHareketCount = await stokHareketProcessor.syncToWeb(null);
        console.log(`✓ Stok Hareketleri: ${stokHareketCount} kayıt (${((Date.now() - stokHareketStartTime) / 1000).toFixed(2)}s)`);
        console.log();

        // 6. CARI HAREKETLERI SENKRONIZASYONU (TAM)
        console.log('6. CARI HAREKETLERI SENKRONIZASYONU (TAM)...');
        const cariHareketStartTime = Date.now();
        const cariHareketCount = await cariHareketProcessor.syncToWeb(null);
        console.log(`✓ Cari Hareketleri: ${cariHareketCount} kayıt (${((Date.now() - cariHareketStartTime) / 1000).toFixed(2)}s)`);
        console.log();

        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('='.repeat(70));
        console.log(`✓ BULK SENKRONIZASYON TAMAMLANDI! (${totalDuration}s)`);
        console.log('='.repeat(70));

    } catch (error) {
        console.error();
        console.error('='.repeat(70));
        console.error('✗ SENKRONIZASYON BAŞARISIZ!');
        console.error('='.repeat(70));
        console.error('Hata:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
        process.exit(0);
    }
}

runBulkSync();