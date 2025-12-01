require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');
const satisProcessor = require('./sync-jobs/satis.processor');

async function testPesinSatis() {
  try {
    console.log('======================================================================');
    console.log('PEŞİN SATIŞ TESTİ');
    console.log('======================================================================\n');

    console.log('1. Test verileri hazırlanıyor...');
    
    // Test cari ve stok
    const testCari = await pgService.queryOne(
      'SELECT id, cari_adi as unvan, cari_kodu FROM cari_hesaplar WHERE cari_kodu = $1',
      ['PKR-MY HOME']
    );
    
    const testStok = await pgService.queryOne(
      'SELECT id, stok_adi, stok_kodu, satis_fiyati FROM stoklar WHERE stok_kodu = $1',
      ['0138-9']
    );
    
    console.log(`   ✓ Test Cari: ${testCari.unvan} (${testCari.cari_kodu})`);
    console.log(`   ✓ Test Stok: ${testStok.stok_kodu} - ${testStok.stok_adi} - ${testStok.satis_fiyati} TL\n`);

    // ERP'de önceki durum
    console.log('2. ERP\'de önceki durum kontrol ediliyor...');
    
    const oncekiHareketler = await mssqlService.query(`
      SELECT COUNT(*) as sayi FROM CARI_HESAP_HAREKETLERI 
      WHERE cha_kod = '${testCari.cari_kodu}'
    `);
    console.log(`   ERP\'de ${testCari.cari_kodu} için ${oncekiHareketler[0].sayi} hareket var\n`);

    // Web'e peşin satış ekle
    console.log('3. Web\'e PEŞİN satış ekleniyor...');
    const satisNo = `TEST-PESIN-${Date.now()}`;
    const miktar = 3;
    const birimFiyat = parseFloat(testStok.satis_fiyati);
    const toplamTutar = miktar * birimFiyat;
    
    const satisResult = await pgService.query(
      `INSERT INTO satislar (
        satis_no, cari_hesap_id, satis_tarihi, 
        odeme_sekli, ara_toplam, toplam_tutar, durum
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6) RETURNING id`,
      [satisNo, testCari.id, 'pesin', toplamTutar, toplamTutar, 'tamamlandi']
    );
    
    const satisId = satisResult[0].id;
    console.log(`   ✓ Satış oluşturuldu: ${satisNo} (ID: ${satisId})`);
    
    // Satış kalemi ekle
    await pgService.query(
      `INSERT INTO satis_kalemleri (
        satis_id, stok_id, miktar, birim_fiyat, 
        kdv_orani, kdv_tutari, toplam_tutar, sira_no
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [satisId, testStok.id, miktar, birimFiyat, 20, toplamTutar * 0.20, toplamTutar, 1]
    );
    
    console.log(`   ✓ Satış kalemi eklendi: ${testStok.stok_kodu} - ${testStok.stok_adi} x ${miktar}`);
    console.log(`   ✓ Toplam: ${toplamTutar} TL (PEŞİN)\n`);

    // Manuel senkronizasyon
    console.log('4. Manuel senkronizasyon deneniyor...');
    const webSatis = await pgService.queryOne(
      'SELECT * FROM satislar WHERE id = $1',
      [satisId]
    );
    
    try {
      await satisProcessor.syncToERP(webSatis);
      console.log('   ✓ Manuel senkronizasyon başarılı\n');
    } catch (error) {
      console.log(`   ✗ Manuel senkronizasyon hatası: ${error.message}`);
      console.log('   Stack:', error.stack);
    }

    // ERP'de yeni durum
    console.log('5. ERP\'de yeni durum kontrol ediliyor...');
    const yeniHareketler = await mssqlService.query(`
      SELECT COUNT(*) as sayi FROM CARI_HESAP_HAREKETLERI 
      WHERE cha_kod = '${testCari.cari_kodu}'
    `);
    
    const fark = yeniHareketler[0].sayi - oncekiHareketler[0].sayi;
    console.log(`   ERP\'de ${testCari.cari_kodu} için ${yeniHareketler[0].sayi} hareket var`);
    
    if (fark === 0) {
      console.log(`   ✓ Peşin satışta cari hareket yazılmadı (DOĞRU!)\n`);
    } else {
      console.log(`   ✗ ${fark} yeni hareket eklendi (YANLIŞ - peşin satışta cari hareket yazılmamalı!)\n`);
    }

    // Stok hareketlerini kontrol et
    console.log('6. ERP\'de stok hareketleri kontrol ediliyor...');
    const stokHareketler = await mssqlService.query(`
      SELECT TOP 5
        sth_evrakno_sira, sth_stok_kod, sth_miktar, sth_tutar, sth_fat_recid_recno
      FROM STOK_HAREKETLERI
      WHERE sth_stok_kod = '${testStok.stok_kodu}'
      ORDER BY sth_RECno DESC
    `);
    
    console.log(`   ${stokHareketler.length} stok hareketi bulundu:`);
    stokHareketler.forEach(sh => {
      console.log(`   - ${sh.sth_evrakno_sira}: ${sh.sth_stok_kod} x ${sh.sth_miktar} = ${sh.sth_tutar} TL (Fat RecID: ${sh.sth_fat_recid_recno || 'YOK'})`);
    });

    // Sonuç
    console.log('\n======================================================================');
    if (fark === 0 && stokHareketler.length > 0) {
      console.log('✓ PEŞİN SATIŞ TESTİ BAŞARILI!');
      console.log('======================================================================');
      console.log('Peşin satışta sadece stok hareketi yazıldı, cari hareket yazılmadı!');
    } else {
      console.log('✗ PEŞİN SATIŞ TESTİ BAŞARISIZ!');
      console.log('======================================================================');
      console.log('Peşin satış doğru işlenmedi. Lütfen log\'ları kontrol edin.');
    }

    
  } catch (error) {
    console.log('\n======================================================================');
    console.log('✗ TEST BAŞARISIZ!');
    console.log('======================================================================');
    console.log('Hata:', error.message);
    console.log('Stack:', error.stack);
  }
}

testPesinSatis();
