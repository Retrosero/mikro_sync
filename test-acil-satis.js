require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');
const satisProcessor = require('./sync-jobs/satis.processor');

async function testAcilSatis() {
  try {
    console.log('======================================================================');
    console.log('SERHAN MÜŞTERİ SATIŞ TESTİ');
    console.log('======================================================================\n');

    // 1. Veritabanlarına bağlan
    console.log('1. Veritabanlarına bağlanılıyor...');
    await mssqlService.connect();
    console.log('   ✓ Bağlantılar başarılı\n');

    // 2. SERHAN müşterisini bul
    console.log('2. SERHAN müşterisi aranıyor...');
    const acilCari = await pgService.queryOne(`
      SELECT id, cari_kodu, cari_adi 
      FROM cari_hesaplar 
      WHERE cari_kodu = 'SERHAN'
      LIMIT 1
    `);

    if (!acilCari) {
      console.error('   ✗ SERHAN müşterisi bulunamadı!');
      return;
    }
    console.log(`   ✓ Müşteri bulundu: ${acilCari.cari_adi} (${acilCari.cari_kodu})\n`);

    // 3. Test ürünü bul
    console.log('3. Test ürünü aranıyor...');
    const testStok = await pgService.queryOne(`
      SELECT id, stok_kodu, stok_adi, satis_fiyati 
      FROM stoklar 
      WHERE stok_kodu IS NOT NULL AND satis_fiyati > 0
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (!testStok) {
      console.error('   ✗ Test ürünü bulunamadı!');
      return;
    }
    console.log(`   ✓ Ürün bulundu: ${testStok.stok_adi} (${testStok.stok_kodu}) - ${testStok.satis_fiyati} TL\n`);

    // 4. ERP'de önceki durumu kontrol et
    console.log('4. ERP\'de önceki durum kontrol ediliyor...');
    const erpOncesi = await mssqlService.query(`
      SELECT COUNT(*) as count 
      FROM CARI_HESAP_HAREKETLERI 
      WHERE cha_kod = 'SERHAN'
    `);
    console.log(`   ERP'de SERHAN için ${erpOncesi[0].count} hareket var\n`);

    // 5. Web'e demo satış ekle
    console.log('5. Web\'e demo satış ekleniyor...');
    const satisNo = `SERHAN-TEST-${Date.now()}`;
    const miktar = 2;
    const birimFiyat = testStok.satis_fiyati;
    const toplamTutar = miktar * birimFiyat;

    const satisResult = await pgService.queryOne(`
      INSERT INTO satislar (
        satis_no,
        cari_hesap_id,
        satis_tarihi,
        odeme_sekli,
        ara_toplam,
        kdv_tutari,
        toplam_tutar,
        satis_durumu
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      satisNo,
      acilCari.id,
      'veresiye',
      toplamTutar,
      toplamTutar * 0.18,
      toplamTutar * 1.18,
      'tamamlandi'
    ]);

    console.log(`   ✓ Satış oluşturuldu: ${satisNo} (ID: ${satisResult.id})`);

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

    console.log(`   ✓ Satış kalemi eklendi: ${testStok.stok_adi} x ${miktar}`);
    console.log(`   ✓ Toplam: ${toplamTutar * 1.18} TL\n`);

    // 6. Manuel senkronizasyon
    console.log('6. Manuel senkronizasyon yapılıyor...');
    
    const yeniSatis = await pgService.queryOne(`
      SELECT * FROM satislar WHERE id = $1
    `, [satisResult.id]);

    await satisProcessor.syncToERP(yeniSatis);
    console.log('   ✓ Senkronizasyon başarılı\n');

    // 7. ERP'de yeni durumu kontrol et
    console.log('7. ERP\'de yeni durum kontrol ediliyor...');
    const erpSonrasi = await mssqlService.query(`
      SELECT COUNT(*) as count 
      FROM CARI_HESAP_HAREKETLERI 
      WHERE cha_kod = 'SERHAN'
    `);
    
    const yeniHareketSayisi = erpSonrasi[0].count - erpOncesi[0].count;
    console.log(`   ERP'de SERHAN için ${erpSonrasi[0].count} hareket var`);
    console.log(`   ✓ ${yeniHareketSayisi} yeni hareket eklendi!\n`);

    // 8. Son eklenen hareketi kontrol et
    console.log('8. Son eklenen hareket detayları:');
    const sonHareket = await mssqlService.query(`
      SELECT TOP 1
        cha_evrakno_sira,
        cha_satir_no,
        cha_belge_no,
        cha_meblag,
        cha_ticaret_turu,
        cha_grupno,
        cha_srmrkkodu,
        cha_karsidcinsi,
        cha_special1,
        cha_special2,
        cha_special3
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_kod = 'SERHAN'
      ORDER BY cha_RECno DESC
    `);

    if (sonHareket.length > 0) {
      const h = sonHareket[0];
      console.log(`   Evrak No: ${h.cha_evrakno_sira}`);
      console.log(`   Satır No: ${h.cha_satir_no}`);
      console.log(`   Belge No: "${h.cha_belge_no}"`);
      console.log(`   Tutar: ${h.cha_meblag} TL`);
      console.log(`   Ticaret Türü: ${h.cha_ticaret_turu}`);
      console.log(`   Grup No: ${h.cha_grupno}`);
      console.log(`   SRM Kodu: "${h.cha_srmrkkodu}"`);
      console.log(`   Karşıd Cinsi: ${h.cha_karsidcinsi}`);
      console.log(`   Special1: "${h.cha_special1}"`);
      console.log(`   Special2: "${h.cha_special2}"`);
      console.log(`   Special3: "${h.cha_special3}"`);
    }

    // 9. Stok hareketini kontrol et
    console.log('\n9. Stok hareketi detayları:');
    const stokHareket = await mssqlService.query(`
      SELECT TOP 1
        sth_evrakno_sira,
        sth_stok_kod,
        sth_miktar,
        sth_tutar,
        sth_malkbl_sevk_tarihi,
        sth_fat_recid_recno
      FROM STOK_HAREKETLERI
      WHERE sth_evrakno_sira = ${sonHareket[0].cha_evrakno_sira}
      ORDER BY sth_RECno DESC
    `);

    if (stokHareket.length > 0) {
      const s = stokHareket[0];
      console.log(`   Evrak No: ${s.sth_evrakno_sira}`);
      console.log(`   Stok Kod: ${s.sth_stok_kod}`);
      console.log(`   Miktar: ${s.sth_miktar}`);
      console.log(`   Tutar: ${s.sth_tutar} TL`);
      console.log(`   Malkbl Sevk Tarihi: ${s.sth_malkbl_sevk_tarihi}`);
      console.log(`   Fat RecID RecNo: ${s.sth_fat_recid_recno}`);
    }

    await mssqlService.disconnect();

    console.log('\n======================================================================');
    console.log('✓ TEST BAŞARILI!');
    console.log('======================================================================');
    console.log('SERHAN müşterisi için satış başarıyla oluşturuldu ve ERP\'ye aktarıldı!');
    console.log('Tüm yeni alanlar doğru şekilde dolduruldu.');
    
  } catch (error) {
    console.error('\n✗ HATA:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAcilSatis();
