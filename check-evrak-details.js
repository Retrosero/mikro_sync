require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkEvrakDetails() {
  try {
    const evrakNo = process.argv[2] || '4548';
    console.log(`Evrak ${evrakNo} detayları kontrol ediliyor...\n`);
    
    await mssqlService.connect();
    
    // Stok hareketi detayları
    console.log('=== STOK HAREKETİ DETAYLARI ===');
    const sthQuery = `
      SELECT TOP 1
        sth_RECno,
        sth_evraktip,
        sth_evrakno_seri,
        sth_evrakno_sira,
        sth_stok_kod,
        sth_miktar,
        sth_tutar,
        sth_fis_tarihi,
        sth_fis_sirano,
        sth_malkbl_sevk_tarihi,
        sth_fat_recid_recno,
        sth_create_user,
        sth_create_date,
        sth_lastup_user,
        sth_lastup_date,
        sth_special1,
        sth_special2,
        sth_special3
      FROM STOK_HAREKETLERI
      WHERE sth_evrakno_sira = ${evrakNo}
      ORDER BY sth_RECno DESC
    `;
    
    const sthResult = await mssqlService.query(sthQuery);
    if (sthResult.length > 0) {
      const sth = sthResult[0];
      console.log('RECno:', sth.sth_RECno);
      console.log('Evrak Tip:', sth.sth_evraktip);
      console.log('Seri:', sth.sth_evrakno_seri);
      console.log('Sıra:', sth.sth_evrakno_sira);
      console.log('Stok Kod:', sth.sth_stok_kod);
      console.log('Miktar:', sth.sth_miktar);
      console.log('Tutar:', sth.sth_tutar);
      console.log('Fiş Tarihi:', sth.sth_fis_tarihi);
      console.log('Fiş Sıra No:', sth.sth_fis_sirano);
      console.log('Malkbl Sevk Tarihi:', sth.sth_malkbl_sevk_tarihi);
      console.log('Fat RecID RecNo:', sth.sth_fat_recid_recno);
      console.log('Create User:', sth.sth_create_user);
      console.log('Create Date:', sth.sth_create_date);
      console.log('LastUp User:', sth.sth_lastup_user);
      console.log('LastUp Date:', sth.sth_lastup_date);
      console.log('Special1:', sth.sth_special1);
      console.log('Special2:', sth.sth_special2);
      console.log('Special3:', sth.sth_special3);
    }
    
    console.log('\n=== CARİ HAREKET DETAYLARI ===');
    const chaQuery = `
      SELECT TOP 1
        cha_RECno,
        cha_evrak_tip,
        cha_evrakno_seri,
        cha_evrakno_sira,
        cha_satir_no,
        cha_belge_no,
        cha_kod,
        cha_ciro_cari_kodu,
        cha_cinsi,
        cha_meblag,
        cha_tarihi,
        cha_belge_tarih,
        cha_ticaret_turu,
        cha_grupno,
        cha_srmrkkodu,
        cha_karsidcinsi,
        cha_create_user,
        cha_create_date,
        cha_lastup_user,
        cha_lastup_date,
        cha_special1,
        cha_special2,
        cha_special3
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrakno_sira = ${evrakNo}
      ORDER BY cha_RECno DESC
    `;
    
    const chaResult = await mssqlService.query(chaQuery);
    if (chaResult.length > 0) {
      const cha = chaResult[0];
      console.log('RECno:', cha.cha_RECno);
      console.log('Evrak Tip:', cha.cha_evrak_tip);
      console.log('Seri:', cha.cha_evrakno_seri);
      console.log('Sıra:', cha.cha_evrakno_sira);
      console.log('Satır No:', cha.cha_satir_no);
      console.log('Belge No:', cha.cha_belge_no);
      console.log('Cari Kod:', cha.cha_kod);
      console.log('Ciro Cari Kodu:', cha.cha_ciro_cari_kodu);
      console.log('Cinsi:', cha.cha_cinsi);
      console.log('Meblag:', cha.cha_meblag);
      console.log('Tarihi:', cha.cha_tarihi);
      console.log('Belge Tarih:', cha.cha_belge_tarih);
      console.log('Ticaret Türü:', cha.cha_ticaret_turu);
      console.log('Grup No:', cha.cha_grupno);
      console.log('SRM Kodu:', cha.cha_srmrkkodu);
      console.log('Karşıd Cinsi:', cha.cha_karsidcinsi);
      console.log('Create User:', cha.cha_create_user);
      console.log('Create Date:', cha.cha_create_date);
      console.log('LastUp User:', cha.cha_lastup_user);
      console.log('LastUp Date:', cha.cha_lastup_date);
      console.log('Special1:', cha.cha_special1);
      console.log('Special2:', cha.cha_special2);
      console.log('Special3:', cha.cha_special3);
    }
    
    await mssqlService.disconnect();
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

checkEvrakDetails();
