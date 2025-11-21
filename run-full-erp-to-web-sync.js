require('dotenv').config();
const stokProcessor = require('./sync-jobs/stok.processor');
const fiyatProcessor = require('./sync-jobs/fiyat.processor');
const logger = require('./utils/logger');
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function runFullSync() {
  try {
    console.log('='.repeat(70));
    console.log('TAM ERP → Web SENKRONIZASYONU');
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

    // Başlangıç durumu
    console.log('BAŞLANGIÇ DURUMU:');
    console.log('-'.repeat(70));
    
    const erpStokCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM STOKLAR WHERE sto_pasif_fl = 0'
    );
    console.log(`ERP Aktif Stok: ${erpStokCount[0].count}`);

    const erpBarkodCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM BARKOD_TANIMLARI'
    );
    console.log(`ERP Barkod: ${erpBarkodCount[0].count}`);

    const erpFiyatCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM STOK_SATIS_FIYAT_LISTELERI WHERE sfiyat_fiyati > 0'
    );
    console.log(`ERP Fiyat: ${erpFiyatCount[0].count}`);

    const webStokCountBefore = await pgService.query('SELECT COUNT(*) as count FROM stoklar');
    console.log(`Web Stok: ${webStokCountBefore[0].count}`);

    const webBarkodCountBefore = await pgService.query('SELECT COUNT(*) as count FROM urun_barkodlari');
    console.log(`Web Barkod: ${webBarkodCountBefore[0].count}`);

    const webFiyatCountBefore = await pgService.query('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');
    console.log(`Web Fiyat: ${webFiyatCountBefore[0].count}`);

    console.log();
    console.log('='.repeat(70));
    console.log();

    // 1. STOK SENKRONIZASYONU
    console.log('1. STOK SENKRONIZASYONU BAŞLIYOR...');
    console.log('-'.repeat(70));
    const stokStartTime = Date.now();
    
    try {
      const stokCount = await stokProcessor.syncToWeb(null); // null = tam senkronizasyon
      const stokDuration = ((Date.now() - stokStartTime) / 1000).toFixed(2);
      console.log(`✓ Stok senkronizasyonu tamamlandı: ${stokCount} kayıt (${stokDuration}s)`);
    } catch (error) {
      console.error(`✗ Stok senkronizasyon hatası: ${error.message}`);
    }

    console.log();

    // 2. BARKOD SENKRONIZASYONU
    console.log('2. BARKOD SENKRONIZASYONU BAŞLIYOR...');
    console.log('-'.repeat(70));
    const barkodStartTime = Date.now();
    
    try {
      const barkodCount = await stokProcessor.syncBarkodlarIncremental(null);
      const barkodDuration = ((Date.now() - barkodStartTime) / 1000).toFixed(2);
      console.log(`✓ Barkod senkronizasyonu tamamlandı: ${barkodCount} kayıt (${barkodDuration}s)`);
    } catch (error) {
      console.error(`✗ Barkod senkronizasyon hatası: ${error.message}`);
    }

    console.log();

    // 3. FİYAT SENKRONIZASYONU
    console.log('3. FİYAT SENKRONIZASYONU BAŞLIYOR...');
    console.log('-'.repeat(70));
    const fiyatStartTime = Date.now();
    
    try {
      const fiyatCount = await fiyatProcessor.syncToWeb(null);
      const fiyatDuration = ((Date.now() - fiyatStartTime) / 1000).toFixed(2);
      console.log(`✓ Fiyat senkronizasyonu tamamlandı: ${fiyatCount} kayıt (${fiyatDuration}s)`);
    } catch (error) {
      console.error(`✗ Fiyat senkronizasyon hatası: ${error.message}`);
    }

    console.log();
    console.log('='.repeat(70));
    console.log();

    // Son durum
    console.log('SON DURUM:');
    console.log('-'.repeat(70));

    const webStokCountAfter = await pgService.query('SELECT COUNT(*) as count FROM stoklar');
    const stokDiff = webStokCountAfter[0].count - webStokCountBefore[0].count;
    console.log(`Web Stok: ${webStokCountBefore[0].count} → ${webStokCountAfter[0].count} (${stokDiff >= 0 ? '+' : ''}${stokDiff})`);

    const webBarkodCountAfter = await pgService.query('SELECT COUNT(*) as count FROM urun_barkodlari');
    const barkodDiff = webBarkodCountAfter[0].count - webBarkodCountBefore[0].count;
    console.log(`Web Barkod: ${webBarkodCountBefore[0].count} → ${webBarkodCountAfter[0].count} (${barkodDiff >= 0 ? '+' : ''}${barkodDiff})`);

    const webFiyatCountAfter = await pgService.query('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');
    const fiyatDiff = webFiyatCountAfter[0].count - webFiyatCountBefore[0].count;
    console.log(`Web Fiyat: ${webFiyatCountBefore[0].count} → ${webFiyatCountAfter[0].count} (${fiyatDiff >= 0 ? '+' : ''}${fiyatDiff})`);

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log();
    console.log(`Toplam Süre: ${totalDuration} saniye`);

    console.log();
    console.log('='.repeat(70));
    console.log('✓ TAM SENKRONIZASYON TAMAMLANDI!');
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

runFullSync();
