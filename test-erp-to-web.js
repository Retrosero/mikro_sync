require('dotenv').config();
const stokProcessor = require('./sync-jobs/stok.processor');
const fiyatProcessor = require('./sync-jobs/fiyat.processor');
const logger = require('./utils/logger');
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function testERPtoWeb() {
  try {
    console.log('='.repeat(60));
    console.log('ERP → Web Senkronizasyon Testi');
    console.log('='.repeat(60));
    console.log();

    // 1. Bağlantı Testi
    console.log('1. Veritabanı bağlantıları test ediliyor...');
    
    try {
      await pgService.query('SELECT 1');
      console.log('   ✓ PostgreSQL bağlantısı başarılı');
    } catch (error) {
      console.error('   ✗ PostgreSQL bağlantı hatası:', error.message);
      throw error;
    }

    try {
      await mssqlService.query('SELECT 1');
      console.log('   ✓ MS SQL bağlantısı başarılı');
    } catch (error) {
      console.error('   ✗ MS SQL bağlantı hatası:', error.message);
      throw error;
    }

    console.log();

    // 2. ERP'deki Stok Sayısı
    console.log('2. ERP veritabanı kontrol ediliyor...');
    const erpStokCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM STOKLAR WHERE sto_pasif_fl = 0'
    );
    console.log(`   Aktif stok sayısı: ${erpStokCount[0].count}`);

    const erpBarkodCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM BARKOD_TANIMLARI'
    );
    console.log(`   Barkod sayısı: ${erpBarkodCount[0].count}`);

    const erpFiyatCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM STOK_SATIS_FIYAT_LISTELERI WHERE sfiyat_fiyati > 0'
    );
    console.log(`   Fiyat kaydı sayısı: ${erpFiyatCount[0].count}`);

    console.log();

    // 3. Web'deki Mevcut Durum
    console.log('3. Web veritabanı kontrol ediliyor...');
    const webStokCount = await pgService.query('SELECT COUNT(*) as count FROM stoklar');
    console.log(`   Mevcut stok sayısı: ${webStokCount[0].count}`);

    const webBarkodCount = await pgService.query('SELECT COUNT(*) as count FROM urun_barkodlari');
    console.log(`   Mevcut barkod sayısı: ${webBarkodCount[0].count}`);

    const webFiyatCount = await pgService.query('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');
    console.log(`   Mevcut fiyat sayısı: ${webFiyatCount[0].count}`);

    console.log();

    // 4. Mapping Tabloları Kontrolü
    console.log('4. Mapping tabloları kontrol ediliyor...');
    const stokMappingCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_stok');
    console.log(`   Stok mapping sayısı: ${stokMappingCount[0].count}`);

    const fiyatListeMappingCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_fiyat_liste');
    console.log(`   Fiyat liste mapping sayısı: ${fiyatListeMappingCount[0].count}`);

    console.log();

    // 5. Stok Senkronizasyonu Testi (İlk 5 kayıt)
    console.log('5. Stok senkronizasyonu test ediliyor (ilk 5 kayıt)...');
    const testStoklar = await mssqlService.query(`
      SELECT TOP 5
        sto_kod, sto_isim, sto_birim1_ad, sto_standartmaliyet,
        sto_sektor_kodu, sto_reyon_kodu, sto_ambalaj_kodu, 
        sto_kalkon_kodu, sto_yabanci_isim, sto_lastup_date
      FROM STOKLAR
      WHERE sto_pasif_fl = 0
      ORDER BY sto_lastup_date DESC
    `);

    console.log(`   ${testStoklar.length} test stok bulundu`);
    
    for (const stok of testStoklar) {
      try {
        await stokProcessor.syncSingleStokToWeb(stok);
        console.log(`   ✓ ${stok.sto_kod} - ${stok.sto_isim}`);
      } catch (error) {
        console.error(`   ✗ ${stok.sto_kod} - Hata: ${error.message}`);
      }
    }

    console.log();

    // 6. Fiyat Senkronizasyonu Testi (İlk 5 kayıt)
    console.log('6. Fiyat senkronizasyonu test ediliyor (ilk 5 kayıt)...');
    const testFiyatlar = await mssqlService.query(`
      SELECT TOP 5
        sfiyat_stokkod, sfiyat_listesirano, sfiyat_fiyati,
        sfiyat_lastup_date
      FROM STOK_SATIS_FIYAT_LISTELERI
      WHERE sfiyat_fiyati > 0
      ORDER BY sfiyat_lastup_date DESC
    `);

    console.log(`   ${testFiyatlar.length} test fiyat bulundu`);
    
    for (const fiyat of testFiyatlar) {
      try {
        const result = await fiyatProcessor.syncSingleFiyatToWeb(fiyat);
        if (result) {
          console.log(`   ✓ ${fiyat.sfiyat_stokkod} - Liste: ${fiyat.sfiyat_listesirano} - Fiyat: ${fiyat.sfiyat_fiyati}`);
        } else {
          console.log(`   ⊘ ${fiyat.sfiyat_stokkod} - Mapping bulunamadı`);
        }
      } catch (error) {
        console.error(`   ✗ ${fiyat.sfiyat_stokkod} - Hata: ${error.message}`);
      }
    }

    console.log();

    // 7. Son Durum
    console.log('7. Senkronizasyon sonrası durum...');
    const finalWebStokCount = await pgService.query('SELECT COUNT(*) as count FROM stoklar');
    console.log(`   Stok sayısı: ${webStokCount[0].count} → ${finalWebStokCount[0].count}`);

    const finalWebBarkodCount = await pgService.query('SELECT COUNT(*) as count FROM urun_barkodlari');
    console.log(`   Barkod sayısı: ${webBarkodCount[0].count} → ${finalWebBarkodCount[0].count}`);

    const finalWebFiyatCount = await pgService.query('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');
    console.log(`   Fiyat sayısı: ${webFiyatCount[0].count} → ${finalWebFiyatCount[0].count}`);

    console.log();
    console.log('='.repeat(60));
    console.log('✓ Test tamamlandı!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error();
    console.error('='.repeat(60));
    console.error('✗ Test başarısız!');
    console.error('='.repeat(60));
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Bağlantıları kapat
    await pgService.disconnect();
    await mssqlService.disconnect();
    process.exit(0);
  }
}

testERPtoWeb();
