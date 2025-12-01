require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');
const satisProcessor = require('./sync-jobs/satis.processor');

async function testRealWebToERP() {
  try {
    console.log('='.repeat(70));
    console.log('GERÇEK WEB → ERP SENKRONIZASYON TESTİ');
    console.log('='.repeat(70));
    console.log();

    // 1. Test için cari ve stok bul
    console.log('1. Test verileri hazırlanıyor...');
    
    const testCari = await pgService.queryOne(`
      SELECT id, cari_kodu, cari_adi 
      FROM cari_hesaplar 
      WHERE cari_kodu IS NOT NULL
      LIMIT 1
    `);

    if (!testCari) {
      console.error('   ✗ Test için cari bulunamadı!');
      return;
    }
    console.log(`   ✓ Test Cari: ${testCari.cari_adi} (${testCari.cari_kodu})`);

    const testStok = await pgService.queryOne(`
      SELECT id, stok_kodu, stok_adi, satis_fiyati 
      FROM stoklar 
      WHERE stok_kodu IS NOT NULL AND satis_fiyati > 0
      LIMIT 1
    `);

    if (!testStok) {
      console.error('   ✗ Test için stok bulunamadı!');
      return;
    }
    console.log(`   ✓ Test Stok: ${testStok.stok_adi} (${testStok.stok_kodu}) - ${testStok.satis_fiyati} TL`);
    console.log();

    // 2. ERP'de önceki durumu kontrol et
    console.log('2. ERP\'de önceki durum kontrol ediliyor...');
    const erpOncesi = await mssqlService.query(`
      SELECT COUNT(*) as count 
      FROM CARI_HESAP_HAREKETLERI 
      WHERE cha_kod = @cariKod
    `, { cariKod: testCari.cari_kodu });
    
    console.log(`   ERP'de ${testCari.cari_kodu} için ${erpOncesi[0].count} hareket var`);
    console.log();

    // 3. Web'e demo satış ekle
    console.log('3. Web\'e demo satış ekleniyor...');
    
    const satisNo = `TEST-${Date.now()}`;
    const miktar = 2;
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
        satis_durumu
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      satisNo,
      testCari.id,
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
    console.log(`   ✓ Toplam: ${toplamTutar * 1.18} TL`);
    console.log();

    // 4. Trigger'ın çalışmasını bekle
    console.log('4. Trigger\'ın çalışması bekleniyor (2 saniye)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log();

    // 5. Manuel senkronizasyon dene
    console.log('5. Manuel senkronizasyon deneniyor...');
    
    const yeniSatis = await pgService.queryOne(`
      SELECT * FROM satislar WHERE id = $1
    `, [satisResult.id]);

    try {
      await satisProcessor.syncToERP(yeniSatis);
      console.log('   ✓ Manuel senkronizasyon başarılı');
    } catch (error) {
      console.error('   ✗ Manuel senkronizasyon hatası:', error.message);
      console.error('   Stack:', error.stack);
    }
    console.log();

    // 6. ERP'de kontrol et
    console.log('6. ERP\'de yeni durum kontrol ediliyor...');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const erpSonrasi = await mssqlService.query(`
      SELECT COUNT(*) as count 
      FROM CARI_HESAP_HAREKETLERI 
      WHERE cha_kod = @cariKod
    `, { cariKod: testCari.cari_kodu });
    
    console.log(`   ERP'de ${testCari.cari_kodu} için ${erpSonrasi[0].count} hareket var`);
    
    const fark = erpSonrasi[0].count - erpOncesi[0].count;
    if (fark > 0) {
      console.log(`   ✓ ${fark} yeni hareket eklendi!`);
    } else {
      console.log(`   ✗ Yeni hareket eklenmedi!`);
    }
    console.log();

    // 7. Son eklenen hareketleri göster
    console.log('7. ERP\'de son eklenen hareketler:');
    const sonHareketler = await mssqlService.query(`
      SELECT TOP 3
        cha_evrakno_seri + CAST(cha_evrakno_sira AS VARCHAR) as evrak_no,
        cha_tarihi,
        cha_kod,
        cha_meblag,
        cha_aciklama
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_kod = @cariKod
      ORDER BY cha_RECno DESC
    `, { cariKod: testCari.cari_kodu });

    sonHareketler.forEach(h => {
      console.log(`   - ${h.evrak_no}: ${h.cha_meblag} TL - ${h.cha_aciklama || 'Açıklama yok'}`);
    });
    console.log();

    // 8. Stok hareketlerini kontrol et
    console.log('8. ERP\'de stok hareketleri kontrol ediliyor...');
    const stokHareketler = await mssqlService.query(`
      SELECT TOP 3
        sth_evrakno_seri + CAST(sth_evrakno_sira AS VARCHAR) as evrak_no,
        sth_tarih,
        sth_stok_kod,
        sth_miktar,
        sth_tutar
      FROM STOK_HAREKETLERI
      WHERE sth_stok_kod = @stokKod
      ORDER BY sth_RECno DESC
    `, { stokKod: testStok.stok_kodu });

    if (stokHareketler.length > 0) {
      console.log(`   ${stokHareketler.length} stok hareketi bulundu:`);
      stokHareketler.forEach(h => {
        console.log(`   - ${h.evrak_no}: ${h.sth_stok_kod} x ${h.sth_miktar} = ${h.sth_tutar} TL`);
      });
    } else {
      console.log('   ⚠ Stok hareketi bulunamadı');
    }
    console.log();

    console.log('='.repeat(70));
    if (fark > 0) {
      console.log('✓ SENKRONIZASYON BAŞARILI!');
      console.log('='.repeat(70));
      console.log(`Web'den ERP'ye satış başarıyla aktarıldı!`);
    } else {
      console.log('✗ SENKRONIZASYON BAŞARISIZ!');
      console.log('='.repeat(70));
      console.log('Satış ERP\'ye aktarılamadı. Lütfen log\'ları kontrol edin.');
    }

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

testRealWebToERP();
