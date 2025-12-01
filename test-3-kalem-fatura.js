require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');
const satisProcessor = require('./sync-jobs/satis.processor');

async function test3KalemFatura() {
  try {
    console.log('='.repeat(70));
    console.log('3 KALEMLİ FATURA TESTİ - SERHAN');
    console.log('='.repeat(70));
    console.log();

    console.log('1. Test verileri hazırlanıyor...');
    
    // SERHAN carisi
    const testCari = await pgService.queryOne(`
      SELECT id, cari_kodu, cari_adi 
      FROM cari_hesaplar 
      WHERE cari_kodu = 'SERHAN'
    `);

    if (!testCari) {
      console.error('   ✗ SERHAN carisi bulunamadı!');
      return;
    }
    console.log(`   ✓ Test Cari: ${testCari.cari_adi} (${testCari.cari_kodu})`);

    // 3 farklı stok
    const stoklar = await pgService.query(`
      SELECT id, stok_kodu, stok_adi, satis_fiyati 
      FROM stoklar 
      WHERE stok_kodu IS NOT NULL
      LIMIT 3
    `);

    if (stoklar.length < 3) {
      console.error('   ✗ Yeterli stok bulunamadı!');
      return;
    }

    console.log('   ✓ Test Stoklar:');
    stoklar.forEach((stok, index) => {
      console.log(`      ${index + 1}. ${stok.stok_kodu} - ${stok.stok_adi} - ${stok.satis_fiyati} TL`);
    });
    console.log();

    // ERP'de önceki durum
    console.log('2. ERP\'de önceki durum kontrol ediliyor...');
    const oncekiHareketler = await mssqlService.query(`
      SELECT COUNT(*) as sayi FROM CARI_HESAP_HAREKETLERI 
      WHERE cha_kod = '${testCari.cari_kodu}'
    `);
    console.log(`   ERP\'de ${testCari.cari_kodu} için ${oncekiHareketler[0].sayi} hareket var`);

    const oncekiStokHareketler = await mssqlService.query(`
      SELECT COUNT(*) as sayi FROM STOK_HAREKETLERI 
      WHERE sth_cari_kodu = '${testCari.cari_kodu}'
    `);
    console.log(`   ERP\'de ${testCari.cari_kodu} için ${oncekiStokHareketler[0].sayi} stok hareketi var\n`);

    // Web'e 3 kalemli satış ekle
    console.log('3. Web\'e 3 kalemli satış ekleniyor...');
    const satisNo = `TEST-3KALEM-${Date.now()}`;
    
    // Toplam tutarı hesapla
    const kalem1Tutar = parseFloat(stoklar[0].satis_fiyati) * 2;
    const kalem2Tutar = parseFloat(stoklar[1].satis_fiyati) * 3;
    const kalem3Tutar = parseFloat(stoklar[2].satis_fiyati) * 1;
    const toplamTutar = kalem1Tutar + kalem2Tutar + kalem3Tutar;
    
    const satisResult = await pgService.query(
      `INSERT INTO satislar (
        satis_no, cari_hesap_id, satis_tarihi, 
        odeme_sekli, ara_toplam, toplam_tutar, durum
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6) RETURNING id`,
      [satisNo, testCari.id, 'veresiye', toplamTutar, toplamTutar, 'tamamlandi']
    );
    
    const satisId = satisResult[0].id;
    console.log(`   ✓ Satış oluşturuldu: ${satisNo} (ID: ${satisId})`);
    
    // Kalem 1
    await pgService.query(
      `INSERT INTO satis_kalemleri (
        satis_id, stok_id, miktar, birim_fiyat, 
        kdv_tutari, toplam_tutar, sira_no
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [satisId, stoklar[0].id, 2, stoklar[0].satis_fiyati, kalem1Tutar * 0.20, kalem1Tutar, 1]
    );
    console.log(`   ✓ Kalem 1: ${stoklar[0].stok_kodu} x 2 = ${kalem1Tutar} TL`);
    
    // Kalem 2
    await pgService.query(
      `INSERT INTO satis_kalemleri (
        satis_id, stok_id, miktar, birim_fiyat, 
        kdv_tutari, toplam_tutar, sira_no
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [satisId, stoklar[1].id, 3, stoklar[1].satis_fiyati, kalem2Tutar * 0.20, kalem2Tutar, 2]
    );
    console.log(`   ✓ Kalem 2: ${stoklar[1].stok_kodu} x 3 = ${kalem2Tutar} TL`);
    
    // Kalem 3
    await pgService.query(
      `INSERT INTO satis_kalemleri (
        satis_id, stok_id, miktar, birim_fiyat, 
        kdv_tutari, toplam_tutar, sira_no
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [satisId, stoklar[2].id, 1, stoklar[2].satis_fiyati, kalem3Tutar * 0.20, kalem3Tutar, 3]
    );
    console.log(`   ✓ Kalem 3: ${stoklar[2].stok_kodu} x 1 = ${kalem3Tutar} TL`);
    console.log(`   ✓ TOPLAM: ${toplamTutar} TL\n`);

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
      return;
    }

    // ERP'de yeni durum
    console.log('5. ERP\'de yeni durum kontrol ediliyor...');
    const yeniHareketler = await mssqlService.query(`
      SELECT COUNT(*) as sayi FROM CARI_HESAP_HAREKETLERI 
      WHERE cha_kod = '${testCari.cari_kodu}'
    `);
    
    const yeniStokHareketler = await mssqlService.query(`
      SELECT COUNT(*) as sayi FROM STOK_HAREKETLERI 
      WHERE sth_cari_kodu = '${testCari.cari_kodu}'
    `);
    
    const cariFark = yeniHareketler[0].sayi - oncekiHareketler[0].sayi;
    const stokFark = yeniStokHareketler[0].sayi - oncekiStokHareketler[0].sayi;
    
    console.log(`   ERP\'de ${testCari.cari_kodu} için ${yeniHareketler[0].sayi} cari hareket var`);
    console.log(`   ERP\'de ${testCari.cari_kodu} için ${yeniStokHareketler[0].sayi} stok hareketi var`);
    
    if (cariFark === 1) {
      console.log(`   ✓ 1 yeni cari hareket eklendi!`);
    } else {
      console.log(`   ✗ Cari hareket sayısı beklenen değil: ${cariFark}`);
    }
    
    if (stokFark === 3) {
      console.log(`   ✓ 3 yeni stok hareketi eklendi!\n`);
    } else {
      console.log(`   ✗ Stok hareket sayısı beklenen değil: ${stokFark}\n`);
    }

    // Son eklenen hareketleri göster
    console.log('6. ERP\'de son eklenen hareketler:');
    const sonCariHareket = await mssqlService.query(`
      SELECT TOP 1 cha_evrakno_sira, cha_meblag, cha_aciklama
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_kod = '${testCari.cari_kodu}'
      ORDER BY cha_RECno DESC
    `);
    
    if (sonCariHareket.length > 0) {
      console.log(`   Cari Hareket: Evrak ${sonCariHareket[0].cha_evrakno_sira} - ${sonCariHareket[0].cha_meblag} TL`);
    }
    
    const sonStokHareketler = await mssqlService.query(`
      SELECT TOP 3 sth_evrakno_sira, sth_stok_kod, sth_miktar, sth_tutar, sth_satirno
      FROM STOK_HAREKETLERI
      WHERE sth_cari_kodu = '${testCari.cari_kodu}'
      ORDER BY sth_RECno DESC
    `);
    
    console.log('   Stok Hareketleri:');
    sonStokHareketler.forEach(sh => {
      console.log(`      Satır ${sh.sth_satirno}: ${sh.sth_stok_kod} x ${sh.sth_miktar} = ${sh.sth_tutar} TL`);
    });

    // Sonuç
    console.log('\n' + '='.repeat(70));
    if (cariFark === 1 && stokFark === 3) {
      console.log('✓ 3 KALEMLİ FATURA TESTİ BAŞARILI!');
      console.log('='.repeat(70));
      console.log('1 cari hareket ve 3 stok hareketi başarıyla eklendi!');
    } else {
      console.log('✗ 3 KALEMLİ FATURA TESTİ BAŞARISIZ!');
      console.log('='.repeat(70));
      console.log('Beklenen hareket sayıları oluşmadı.');
    }
    
  } catch (error) {
    console.log('\n' + '='.repeat(70));
    console.log('✗ TEST BAŞARISIZ!');
    console.log('='.repeat(70));
    console.log('Hata:', error.message);
    console.log('Stack:', error.stack);
  }
}

test3KalemFatura();
