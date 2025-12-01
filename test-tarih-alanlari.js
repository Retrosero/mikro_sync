require('dotenv').config();
const pgService = require('./services/postgresql.service');
const satisProcessor = require('./sync-jobs/satis.processor');

async function testTarihAlanlari() {
  try {
    console.log('='.repeat(70));
    console.log('TARİH ALANLARI VE İLİŞKİ TESTİ');
    console.log('='.repeat(70));
    console.log();

    // Test için yeni bir satış oluştur
    console.log('1. Test satışı oluşturuluyor...');
    
    const testCari = await pgService.queryOne(`
      SELECT id, cari_kodu, cari_adi
      FROM cari_hesaplar
      WHERE cari_kodu = 'PKR-MY HOME'
      LIMIT 1
    `);

    const testStok = await pgService.queryOne(`
      SELECT id, stok_kodu, stok_adi, satis_fiyati
      FROM stoklar
      WHERE stok_kodu = '0138-9'
      LIMIT 1
    `);

    if (!testCari || !testStok) {
      console.log('Test verileri bulunamadı!');
      return;
    }

    const satisNo = `TEST-TARIH-${Date.now()}`;
    const miktar = 1;
    const birimFiyat = parseFloat(testStok.satis_fiyati);
    const toplamTutar = miktar * birimFiyat;

    // Satış başlığı ekle
    const satisResult = await pgService.queryOne(`
      INSERT INTO satislar (
        satis_no,
        cari_hesap_id,
        satis_tarihi,
        odeme_sekli,
        ara_toplam,
        kdv_tutari,
        toplam_tutar,
        satis_durumu,
        olusturma_tarihi,
        guncelleme_tarihi
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id, olusturma_tarihi, guncelleme_tarihi
    `, [
      satisNo,
      testCari.id,
      'nakit',
      toplamTutar,
      toplamTutar * 0.18,
      toplamTutar * 1.18,
      'tamamlandi'
    ]);

    console.log(`   ✓ Satış oluşturuldu: ${satisNo}`);
    console.log(`   ✓ Oluşturma tarihi: ${satisResult.olusturma_tarihi}`);
    console.log(`   ✓ Güncelleme tarihi: ${satisResult.guncelleme_tarihi}`);

    // Satış kalemi ekle
    await pgService.query(`
      INSERT INTO satis_kalemleri (
        satis_id,
        stok_id,
        miktar,
        birim_fiyat,
        kdv_orani,
        toplam_tutar,
        sira_no
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      satisResult.id,
      testStok.id,
      miktar,
      birimFiyat,
      18,
      toplamTutar * 1.18,
      1
    ]);

    console.log(`   ✓ Satış kalemi eklendi: ${testStok.stok_kodu} x ${miktar}`);
    console.log();

    // Satışı tekrar oku (tam veriyle)
    const satis = await pgService.queryOne(`
      SELECT * FROM satislar WHERE id = $1
    `, [satisResult.id]);

    console.log('2. Senkronizasyon başlatılıyor...');
    console.log(`   Satış ID: ${satis.id}`);
    console.log(`   Oluşturma: ${satis.olusturma_tarihi}`);
    console.log(`   Güncelleme: ${satis.guncelleme_tarihi}`);
    console.log();

    // Manuel senkronizasyon
    await satisProcessor.syncToERP(satis);

    console.log();
    console.log('='.repeat(70));
    console.log('✓ TEST TAMAMLANDI');
    console.log('='.repeat(70));
    console.log();
    console.log('NOT: ERP\'de oluşan kayıtların tarih alanlarını kontrol edin:');
    console.log('  - CARI_HESAP_HAREKETLERI: cha_create_date, cha_lastup_date');
    console.log('  - STOK_HAREKETLERI: sth_create_date, sth_lastup_date, sth_fat_recid_recno');

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

testTarihAlanlari();
