require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function verifyFinalTest() {
  try {
    console.log('='.repeat(70));
    console.log('SON TEST DOĞRULAMA - DETAYLI KONTROL');
    console.log('='.repeat(70));
    console.log();

    // Son eklenen cari hareket
    console.log('1. CARI_HESAP_HAREKETLERI - Son kayıt:');
    const cariHareket = await mssqlService.query(`
      SELECT TOP 1 *
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_kod = 'ACİL'
      ORDER BY cha_RECno DESC
    `);

    if (cariHareket.length > 0) {
      const ch = cariHareket[0];
      console.log(`\n  ✓ Cari Hareket Bulundu!`);
      console.log(`  RECno: ${ch.cha_RECno}`);
      console.log(`  Cari: ${ch.cha_kod}`);
      console.log(`  Evrak: ${ch.cha_evrakno_seri}${ch.cha_evrakno_sira}`);
      console.log(`  Tutar: ${ch.cha_meblag} TL`);
      console.log(`  Ara Toplam: ${ch.cha_aratoplam} TL`);
      console.log(`  Tarih: ${ch.cha_tarihi}`);
      console.log(`  Create Date: ${ch.cha_create_date}`);
      console.log(`  Lastup Date: ${ch.cha_lastup_date}`);
      console.log(`  Create User: ${ch.cha_create_user}`);
      console.log(`  Lastup User: ${ch.cha_lastup_user}`);
      console.log(`  Tip: ${ch.cha_tip}`);
      console.log(`  Cinsi: ${ch.cha_cinsi}`);
      console.log(`  Evrak Tip: ${ch.cha_evrak_tip}`);
    } else {
      console.log('  ✗ Cari hareket bulunamadı!');
    }

    console.log('\n' + '='.repeat(70));
    console.log('2. STOK_HAREKETLERI - Son kayıt:');
    const stokHareket = await mssqlService.query(`
      SELECT TOP 1 *
      FROM STOK_HAREKETLERI
      WHERE sth_cari_kodu = 'ACİL'
      ORDER BY sth_RECno DESC
    `);

    if (stokHareket.length > 0) {
      const sh = stokHareket[0];
      console.log(`\n  ✓ Stok Hareket Bulundu!`);
      console.log(`  RECno: ${sh.sth_RECno}`);
      console.log(`  Stok: ${sh.sth_stok_kod}`);
      console.log(`  Cari: ${sh.sth_cari_kodu}`);
      console.log(`  Evrak: ${sh.sth_evrakno_seri}${sh.sth_evrakno_sira}`);
      console.log(`  Miktar: ${sh.sth_miktar}`);
      console.log(`  Tutar: ${sh.sth_tutar} TL`);
      console.log(`  Tarih: ${sh.sth_tarih}`);
      console.log(`  Create Date: ${sh.sth_create_date}`);
      console.log(`  Lastup Date: ${sh.sth_lastup_date}`);
      console.log(`  Create User: ${sh.sth_create_user}`);
      console.log(`  Lastup User: ${sh.sth_lastup_user}`);
      console.log(`  Fat RecID DBCno: ${sh.sth_fat_recid_dbcno}`);
      console.log(`  Fat RecID RecNo: ${sh.sth_fat_recid_recno}`);
      console.log();
      console.log('  Diğer Alanlar:');
      console.log(`  - Satirno: ${sh.sth_satirno}`);
      console.log(`  - Belge No: '${sh.sth_belge_no}'`);
      console.log(`  - Isk Mas1: ${sh.sth_isk_mas1}`);
      console.log(`  - Pos Satis: ${sh.sth_pos_satis}`);
      console.log(`  - Promosyon FL: ${sh.sth_promosyon_fl}`);
      console.log(`  - Cari Cinsi: ${sh.sth_cari_cinsi}`);
      console.log(`  - Plasiyer Kodu: '${sh.sth_plasiyer_kodu}'`);
      console.log(`  - Aciklama: '${sh.sth_aciklama}'`);
      console.log(`  - Vergisiz FL: ${sh.sth_vergisiz_fl}`);
      console.log(`  - Taxfree FL: ${sh.sth_taxfree_fl}`);
    } else {
      console.log('  ✗ Stok hareket bulunamadı!');
    }

    console.log('\n' + '='.repeat(70));
    console.log('3. İLİŞKİ KONTROLÜ:');
    
    if (cariHareket.length > 0 && stokHareket.length > 0) {
      const ch = cariHareket[0];
      const sh = stokHareket[0];
      
      console.log(`\n  Cari Hareket RECno: ${ch.cha_RECno}`);
      console.log(`  Stok Hareket Fat RecID RecNo: ${sh.sth_fat_recid_recno}`);
      
      if (ch.cha_RECno === sh.sth_fat_recid_recno) {
        console.log(`  ✓ İlişki DOĞRU! Cari ve stok hareketleri bağlı.`);
      } else {
        console.log(`  ✗ İlişki HATALI! Değerler eşleşmiyor.`);
      }
      
      // Evrak numarası kontrolü
      if (ch.cha_evrakno_sira === sh.sth_evrakno_sira) {
        console.log(`  ✓ Evrak numaraları eşleşiyor: ${ch.cha_evrakno_sira}`);
      } else {
        console.log(`  ✗ Evrak numaraları farklı!`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ DOĞRULAMA TAMAMLANDI');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await mssqlService.disconnect();
    process.exit(0);
  }
}

verifyFinalTest();
