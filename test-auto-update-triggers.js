require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function testAutoUpdateTriggers() {
  try {
    console.log('='.repeat(70));
    console.log('OTOMATIK GÜNCELLEME TRİGGER\'LARI TESTİ');
    console.log('='.repeat(70));
    console.log();

    // Test için bir stok seç
    const testStok = await pgService.queryOne(`
      SELECT id, stok_kodu, stok_adi, barkod, satis_fiyati
      FROM stoklar
      LIMIT 1
    `);

    if (!testStok) {
      console.log('Test için stok bulunamadı!');
      return;
    }

    console.log('Test Stok:');
    console.log(`  ID: ${testStok.id}`);
    console.log(`  Kod: ${testStok.stok_kodu}`);
    console.log(`  Ad: ${testStok.stok_adi}`);
    console.log(`  Mevcut Barkod: ${testStok.barkod || 'YOK'}`);
    console.log(`  Mevcut Fiyat: ${testStok.satis_fiyati || 'YOK'}`);
    console.log();

    // TEST 1: Ana Barkod Ekleme
    console.log('TEST 1: Ana Barkod Ekleme');
    console.log('-'.repeat(70));
    
    const testBarkod = '9999999999999';
    console.log(`Yeni ana barkod ekleniyor: ${testBarkod}`);
    
    await pgService.query(`
      INSERT INTO urun_barkodlari (stok_id, barkod, barkod_tipi, aktif)
      VALUES ($1, $2, 'ana', true)
      ON CONFLICT (barkod) DO UPDATE SET
        stok_id = EXCLUDED.stok_id,
        barkod_tipi = EXCLUDED.barkod_tipi,
        aktif = EXCLUDED.aktif
    `, [testStok.id, testBarkod]);

    const afterBarkod = await pgService.queryOne(`
      SELECT barkod FROM stoklar WHERE id = $1
    `, [testStok.id]);

    console.log(`✓ Barkod eklendi`);
    console.log(`  Stoklar tablosundaki barkod: ${afterBarkod.barkod}`);
    console.log(`  Trigger çalıştı mı? ${afterBarkod.barkod === testBarkod ? '✓ EVET' : '✗ HAYIR'}`);
    console.log();

    // TEST 2: Fiyat Ekleme
    console.log('TEST 2: Ana Fiyat Ekleme (Liste No 1)');
    console.log('-'.repeat(70));

    // İlk fiyat listesini bul
    const firstPriceList = await pgService.queryOne(`
      SELECT web_fiyat_tanimi_id 
      FROM int_kodmap_fiyat_liste 
      WHERE erp_liste_no = 1
    `);

    if (firstPriceList) {
      const testFiyat = 123.45;
      console.log(`Yeni fiyat ekleniyor: ${testFiyat} TL`);

      await pgService.query(`
        INSERT INTO urun_fiyat_listeleri (stok_id, fiyat_tanimi_id, fiyat)
        VALUES ($1, $2, $3)
        ON CONFLICT (stok_id, fiyat_tanimi_id) DO UPDATE SET
          fiyat = EXCLUDED.fiyat,
          guncelleme_tarihi = NOW()
      `, [testStok.id, firstPriceList.web_fiyat_tanimi_id, testFiyat]);

      const afterFiyat = await pgService.queryOne(`
        SELECT satis_fiyati FROM stoklar WHERE id = $1
      `, [testStok.id]);

      console.log(`✓ Fiyat eklendi`);
      console.log(`  Stoklar tablosundaki fiyat: ${afterFiyat.satis_fiyati} TL`);
      console.log(`  Trigger çalıştı mı? ${parseFloat(afterFiyat.satis_fiyati) === testFiyat ? '✓ EVET' : '✗ HAYIR'}`);
    } else {
      console.log('⚠ İlk fiyat listesi bulunamadı, test atlanıyor');
    }
    console.log();

    // TEST 3: Barkod Güncelleme
    console.log('TEST 3: Barkod Güncelleme');
    console.log('-'.repeat(70));

    const updatedBarkod = '8888888888888';
    console.log(`Barkod güncelleniyor: ${testBarkod} → ${updatedBarkod}`);

    await pgService.query(`
      UPDATE urun_barkodlari 
      SET barkod = $1
      WHERE stok_id = $2 AND barkod = $3
    `, [updatedBarkod, testStok.id, testBarkod]);

    const afterUpdate = await pgService.queryOne(`
      SELECT barkod FROM stoklar WHERE id = $1
    `, [testStok.id]);

    console.log(`✓ Barkod güncellendi`);
    console.log(`  Stoklar tablosundaki barkod: ${afterUpdate.barkod}`);
    console.log(`  Trigger çalıştı mı? ${afterUpdate.barkod === updatedBarkod ? '✓ EVET' : '✗ HAYIR'}`);
    console.log();

    // TEST 4: Fiyat Güncelleme
    if (firstPriceList) {
      console.log('TEST 4: Fiyat Güncelleme');
      console.log('-'.repeat(70));

      const updatedFiyat = 234.56;
      console.log(`Fiyat güncelleniyor: ${updatedFiyat} TL`);

      await pgService.query(`
        UPDATE urun_fiyat_listeleri 
        SET fiyat = $1
        WHERE stok_id = $2 AND fiyat_tanimi_id = $3
      `, [updatedFiyat, testStok.id, firstPriceList.web_fiyat_tanimi_id]);

      const afterFiyatUpdate = await pgService.queryOne(`
        SELECT satis_fiyati FROM stoklar WHERE id = $1
      `, [testStok.id]);

      console.log(`✓ Fiyat güncellendi`);
      console.log(`  Stoklar tablosundaki fiyat: ${afterFiyatUpdate.satis_fiyati} TL`);
      console.log(`  Trigger çalıştı mı? ${parseFloat(afterFiyatUpdate.satis_fiyati) === updatedFiyat ? '✓ EVET' : '✗ HAYIR'}`);
      console.log();
    }

    // TEST 5: Barkod Silme
    console.log('TEST 5: Barkod Silme');
    console.log('-'.repeat(70));

    console.log(`Barkod siliniyor: ${updatedBarkod}`);

    await pgService.query(`
      DELETE FROM urun_barkodlari 
      WHERE stok_id = $1 AND barkod = $2
    `, [testStok.id, updatedBarkod]);

    const afterDelete = await pgService.queryOne(`
      SELECT barkod FROM stoklar WHERE id = $1
    `, [testStok.id]);

    console.log(`✓ Barkod silindi`);
    console.log(`  Stoklar tablosundaki barkod: ${afterDelete.barkod || 'NULL'}`);
    console.log(`  Trigger çalıştı mı? ${afterDelete.barkod === null ? '✓ EVET' : '✗ HAYIR'}`);
    console.log();

    console.log('='.repeat(70));
    console.log('✓ TÜM TESTLER TAMAMLANDI!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error();
    console.error('='.repeat(70));
    console.error('✗ TEST BAŞARISIZ!');
    console.error('='.repeat(70));
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgService.disconnect();
    process.exit(0);
  }
}

testAutoUpdateTriggers();
