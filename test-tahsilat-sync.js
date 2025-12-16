require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

/**
 * Tahsilat Senkronizasyon Test Script
 * 
 * Bu script 5 farklı tahsilat tipini test eder:
 * 1. Nakit
 * 2. Çek
 * 3. Senet
 * 4. Havale
 * 5. Kredi Kartı
 */

async function testTahsilatSync() {
  try {
    console.log('='.repeat(70));
    console.log('TAHSİLAT SENKRONIZASYON TESTİ');
    console.log('='.repeat(70));
    console.log();

    // Test için müşteri seç
    const carilar = await pgService.query(`
      SELECT id, cari_kodu, cari_adi 
      FROM cari_hesaplar 
      WHERE aktif = true 
      LIMIT 1
    `);

    if (carilar.length === 0) {
      throw new Error('Test için aktif cari hesap bulunamadı!');
    }

    const testCari = carilar[0];
    console.log(`Test Müşteri: ${testCari.cari_adi} (${testCari.cari_kodu})`);
    console.log();

    // Kasa seç
    const kasalar = await pgService.query(`
      SELECT id, kasa_adi, kasa_kodu 
      FROM kasalar 
      WHERE aktif = true 
      LIMIT 1
    `);

    const testKasa = kasalar.length > 0 ? kasalar[0] : null;

    // Banka seç
    const bankalar = await pgService.query(`
      SELECT id, banka_adi, ban_kod 
      FROM bankalar 
      WHERE aktif = true 
      LIMIT 1
    `);

    const testBanka = bankalar.length > 0 ? bankalar[0] : null;

    // Tahsilat seri/sıra no al
    const userFaturaAyarlari = await pgService.query(`
      SELECT tahsilat_seri_no, tahsilat_sira_no 
      FROM user_fatura_ayarlari 
      LIMIT 1
    `);

    let seriNo = 'T';
    let siraNo = 1;

    if (userFaturaAyarlari.length > 0) {
      seriNo = userFaturaAyarlari[0].tahsilat_seri_no || 'T';
      siraNo = (userFaturaAyarlari[0].tahsilat_sira_no || 1) + 9000; // Çakışmayı önlemek için 9000 ekle
    }

    const testTahsilatlar = [];

    // 1. NAKİT TAHSİLAT
    if (testKasa) {
      console.log('1. Nakit tahsilat oluşturuluyor...');
      const nakitTahsilat = await pgService.query(`
        INSERT INTO tahsilatlar (
          tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
          tutar, kasa_id, aciklama, tahsilat_durumu,
          tahsilat_seri_no, tahsilat_sira_no
        ) VALUES (
          $1, $2, CURRENT_DATE, 'nakit',
          100.00, $3, 'Test nakit tahsilat', 'tahsil_edildi',
          $4, $5
        ) RETURNING id
      `, [`TEST-NAK-${Date.now()}`, testCari.id, testKasa.id, seriNo, siraNo++]);

      testTahsilatlar.push({ id: nakitTahsilat[0].id, tip: 'nakit' });
      console.log(`   ✓ Nakit tahsilat oluşturuldu: ${nakitTahsilat[0].id}`);
    }

    // 2. ÇEK TAHSİLAT
    console.log('2. Çek tahsilat oluşturuluyor...');
    const cekTahsilat = await pgService.query(`
      INSERT INTO tahsilatlar (
        tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
        tutar, cek_no, cek_vade_tarihi, banka_adi,
        aciklama, tahsilat_durumu, tahsilat_seri_no, tahsilat_sira_no
      ) VALUES (
        $1, $2, CURRENT_DATE, 'cek',
        200.00, 'CEK123456', CURRENT_DATE + INTERVAL '30 days',
        'Test Bankası - Test Şubesi - TR123456789',
        'Test çek tahsilat', 'tahsil_edildi', $3, $4
      ) RETURNING id
    `, [`TEST-CEK-${Date.now()}`, testCari.id, seriNo, siraNo++]);

    testTahsilatlar.push({ id: cekTahsilat[0].id, tip: 'cek' });
    console.log(`   ✓ Çek tahsilat oluşturuldu: ${cekTahsilat[0].id}`);

    // 3. SENET TAHSİLAT
    console.log('3. Senet tahsilat oluşturuluyor...');
    const senetTahsilat = await pgService.query(`
      INSERT INTO tahsilatlar (
        tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
        tutar, cek_no, vade_tarihi, banka_adi,
        aciklama, tahsilat_durumu, tahsilat_seri_no, tahsilat_sira_no
      ) VALUES (
        $1, $2, CURRENT_DATE, 'senet',
        300.00, 'SEN789', CURRENT_DATE + INTERVAL '60 days',
        'Ankara - Çankaya',
        'Test senet tahsilat', 'tahsil_edildi', $3, $4
      ) RETURNING id
    `, [`TEST-SEN-${Date.now()}`, testCari.id, seriNo, siraNo++]);

    testTahsilatlar.push({ id: senetTahsilat[0].id, tip: 'senet' });
    console.log(`   ✓ Senet tahsilat oluşturuldu: ${senetTahsilat[0].id}`);

    // 4. HAVALE TAHSİLAT
    if (testBanka) {
      console.log('4. Havale tahsilat oluşturuluyor...');
      const havaleTahsilat = await pgService.query(`
        INSERT INTO tahsilatlar (
          tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
          tutar, banka_id, dekont_no, aciklama, tahsilat_durumu,
          tahsilat_seri_no, tahsilat_sira_no
        ) VALUES (
          $1, $2, CURRENT_DATE, 'havale',
          400.00, $3, 'DEKONT123', 'Test havale tahsilat', 'tahsil_edildi',
          $4, $5
        ) RETURNING id
      `, [`TEST-HAV-${Date.now()}`, testCari.id, testBanka.id, seriNo, siraNo++]);

      testTahsilatlar.push({ id: havaleTahsilat[0].id, tip: 'havale' });
      console.log(`   ✓ Havale tahsilat oluşturuldu: ${havaleTahsilat[0].id}`);
    }

    // 5. KREDİ KARTI TAHSİLAT
    if (testBanka) {
      console.log('5. Kredi kartı tahsilat oluşturuluyor...');
      const krediKartiTahsilat = await pgService.query(`
        INSERT INTO tahsilatlar (
          tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
          tutar, banka_id, aciklama, tahsilat_durumu,
          tahsilat_seri_no, tahsilat_sira_no
        ) VALUES (
          $1, $2, CURRENT_DATE, 'kredi_karti',
          500.00, $3, 'Test kredi kartı tahsilat', 'tahsil_edildi',
          $4, $5
        ) RETURNING id
      `, [`TEST-KK-${Date.now()}`, testCari.id, testBanka.id, seriNo, siraNo++]);

      testTahsilatlar.push({ id: krediKartiTahsilat[0].id, tip: 'kredi_karti' });
      console.log(`   ✓ Kredi kartı tahsilat oluşturuldu: ${krediKartiTahsilat[0].id}`);
    }

    console.log();
    console.log(`Toplam ${testTahsilatlar.length} test tahsilat oluşturuldu.`);
    console.log();
    console.log('Şimdi senkronizasyonu başlatmak için şu komutu çalıştırın:');
    console.log('  npm run sync-web-to-erp');
    console.log();
    console.log('Senkronizasyon sonrası ERP\'de kontrol edin:');
    console.log('  - CARI_HESAP_HAREKETLERI tablosunda kayıtlar');
    console.log('  - ODEME_EMIRLERI tablosunda çek/senet/havale/kredi kartı kayıtları');
    console.log();

    await pgService.disconnect();

  } catch (error) {
    console.error('Test hatası:', error);
    process.exit(1);
  }
}

testTahsilatSync();
