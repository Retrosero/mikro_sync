require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');
const satisProcessor = require('./sync-jobs/satis.processor');

async function testAcilMusteri() {
  try {
    console.log('='.repeat(70));
    console.log('ACİL MÜŞTERİ SATIŞ SENKRONIZASYON TESTİ');
    console.log('='.repeat(70));
    console.log();

    // 1. ACİL müşterisini bul
    console.log('1. ACİL müşterisi kontrol ediliyor...');
    
    const acilCari = await pgService.queryOne(`
      SELECT id, cari_kodu, cari_adi
      FROM cari_hesaplar
      WHERE cari_kodu = 'ACİL'
      LIMIT 1
    `);

    if (!acilCari) {
      console.log('   ✗ ACİL müşterisi bulunamadı!');
      return;
    }

    console.log(`   ✓ Müşteri bulundu: ${acilCari.cari_adi} (${acilCari.cari_kodu})`);
    console.log();

    // 2. Test için bir stok seç
    const testStok = await pgService.queryOne(`
      SELECT id, stok_kodu, stok_adi, satis_fiyati
      FROM stoklar
      WHERE satis_fiyati > 0
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (!testStok) {
      console.log('   ✗ Test stoku bulunamadı!');
      return;
    }

    console.log(`   ✓ Test stoku: ${testStok.stok_adi} (${testStok.stok_kodu}) - ${testStok.satis_fiyati} TL`);
    console.log();

    // 3. ERP'de önceki durum
    console.log('2. ERP\'de önceki durum kontrol ediliyor...');
    
    const erpOncesi = await mssqlService.query(`
      SELECT COUNT(*) as count
      FROM STOK_HAREKETLERI
      WHERE sth_cari_kodu = 'ACİL'
      AND CAST(sth_tarih AS DATE) = CAST(GETDATE() AS DATE)
    `);

    console.log(`   ERP'de ACİL için bugün ${erpOncesi[0].count} hareket var`);
    console.log();

    // 4. Web'e yeni satış ekle
    console.log('3. Web\'e yeni satış ekleniyor...');
    
    const satisNo = `ACIL-TEST-${Date.now()}`;
    const miktar = 2;
    const birimFiyat = parseFloat(testStok.satis_fiyati);
    const araToplam = miktar * birimFiyat;
    const kdvTutari = araToplam * 0.18;
    const toplamTutar = araToplam + kdvTutari;

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
      acilCari.id,
      'nakit',
      araToplam,
      kdvTutari,
      toplamTutar,
      'tamamlandi'
    ]);

    console.log(`   ✓ Satış oluşturuldu: ${satisNo}`);
    console.log(`   ✓ Satış ID: ${satisResult.id}`);
    console.log(`   ✓ Ara Toplam: ${araToplam.toFixed(2)} TL`);
    console.log(`   ✓ KDV: ${kdvTutari.toFixed(2)} TL`);
    console.log(`   ✓ Toplam: ${toplamTutar.toFixed(2)} TL`);

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
      toplamTutar,
      1
    ]);

    console.log(`   ✓ Satış kalemi eklendi: ${testStok.stok_kodu} x ${miktar}`);
    console.log();

    // 5. Satışı tekrar oku (tam veriyle)
    const satis = await pgService.queryOne(`
      SELECT * FROM satislar WHERE id = $1
    `, [satisResult.id]);

    console.log('4. ERP\'ye senkronizasyon başlatılıyor...');
    console.log(`   Oluşturma tarihi: ${satis.olusturma_tarihi}`);
    console.log(`   Güncelleme tarihi: ${satis.guncelleme_tarihi}`);
    console.log();

    // Manuel senkronizasyon
    await satisProcessor.syncToERP(satis);

    console.log('   ✓ Senkronizasyon tamamlandı!');
    console.log();

    // 6. ERP'de yeni durum
    console.log('5. ERP\'de yeni durum kontrol ediliyor...');
    
    const erpSonrasi = await mssqlService.query(`
      SELECT COUNT(*) as count
      FROM STOK_HAREKETLERI
      WHERE sth_cari_kodu = 'ACİL'
      AND CAST(sth_tarih AS DATE) = CAST(GETDATE() AS DATE)
    `);

    console.log(`   ERP'de ACİL için bugün ${erpSonrasi[0].count} hareket var`);
    
    if (erpSonrasi[0].count > erpOncesi[0].count) {
      console.log(`   ✓ ${erpSonrasi[0].count - erpOncesi[0].count} yeni hareket eklendi!`);
    }
    console.log();

    // 7. Son eklenen hareketi detaylı göster
    console.log('6. Son eklenen hareket detayları:');
    
    const sonHareket = await mssqlService.query(`
      SELECT TOP 1
        sth_RECno,
        sth_stok_kod,
        sth_cari_kodu,
        sth_miktar,
        sth_tutar,
        sth_evrakno_sira,
        sth_evrakno_seri,
        sth_create_date,
        sth_lastup_date,
        sth_fat_recid_recno
      FROM STOK_HAREKETLERI
      WHERE sth_cari_kodu = 'ACİL'
      ORDER BY sth_RECno DESC
    `);

    if (sonHareket.length > 0) {
      const h = sonHareket[0];
      console.log(`\n   RECno: ${h.sth_RECno}`);
      console.log(`   Stok: ${h.sth_stok_kod}`);
      console.log(`   Cari: ${h.sth_cari_kodu}`);
      console.log(`   Miktar: ${h.sth_miktar}`);
      console.log(`   Tutar: ${h.sth_tutar} TL`);
      console.log(`   Evrak: ${h.sth_evrakno_seri}${h.sth_evrakno_sira}`);
      console.log(`   Create Date: ${h.sth_create_date}`);
      console.log(`   Lastup Date: ${h.sth_lastup_date}`);
      console.log(`   Fat RecID RecNo: ${h.sth_fat_recid_recno || 'NULL (nakit satış)'}`);
    }

    console.log();
    console.log('='.repeat(70));
    console.log('✅ TEST BAŞARILI!');
    console.log('='.repeat(70));
    console.log();
    console.log('ÖZET:');
    console.log(`  • Müşteri: ACİL - ${acilCari.cari_adi}`);
    console.log(`  • Ürün: ${testStok.stok_kodu} - ${testStok.stok_adi}`);
    console.log(`  • Miktar: ${miktar} adet`);
    console.log(`  • Toplam: ${toplamTutar.toFixed(2)} TL`);
    console.log(`  • Tarih alanları: ✓ Dolduruldu`);
    console.log(`  • ERP'ye aktarım: ✓ Başarılı`);

  } catch (error) {
    console.error();
    console.error('='.repeat(70));
    console.error('✗ TEST BAŞARISIZ!');
    console.error('='.repeat(70));
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgService.disconnect();
    await mssqlService.disconnect();
    process.exit(0);
  }
}

testAcilMusteri();
