require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkAllSthFields() {
  try {
    const evrakNo = process.argv[2] || '4551';
    console.log(`Evrak ${evrakNo} - TÜM STOK HAREKETİ ALANLARI\n`);
    
    const query = `
      SELECT *
      FROM STOK_HAREKETLERI
      WHERE sth_evrakno_sira = ${evrakNo}
      ORDER BY sth_RECno DESC
    `;
    
    const result = await mssqlService.query(query);
    
    if (result.length === 0) {
      console.log('Kayıt bulunamadı!');
      return;
    }
    
    const record = result[0];
    
    // NULL olan alanları bul
    const nullFields = [];
    const filledFields = [];
    
    Object.keys(record).forEach(key => {
      if (record[key] === null) {
        nullFields.push(key);
      } else {
        filledFields.push(key);
      }
    });
    
    console.log('='.repeat(70));
    console.log(`TOPLAM ALAN SAYISI: ${Object.keys(record).length}`);
    console.log(`DOLU ALAN SAYISI: ${filledFields.length}`);
    console.log(`NULL ALAN SAYISI: ${nullFields.length}`);
    console.log('='.repeat(70));
    
    if (nullFields.length > 0) {
      console.log('\n❌ NULL OLAN ALANLAR:');
      nullFields.forEach(field => {
        console.log(`   - ${field}`);
      });
    } else {
      console.log('\n✅ TÜM ALANLAR DOLU!');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('ÖNEMLİ ALANLAR:');
    console.log('='.repeat(70));
    console.log('sth_RECno:', record.sth_RECno);
    console.log('sth_evrakno_sira:', record.sth_evrakno_sira);
    console.log('sth_stok_kod:', record.sth_stok_kod);
    console.log('sth_miktar:', record.sth_miktar);
    console.log('sth_tutar:', record.sth_tutar);
    console.log('sth_isk_mas1:', record.sth_isk_mas1);
    console.log('sth_isk_mas2:', record.sth_isk_mas2);
    console.log('sth_birim_pntr:', record.sth_birim_pntr);
    console.log('sth_pos_satis:', record.sth_pos_satis);
    console.log('sth_promosyon_fl:', record.sth_promosyon_fl);
    console.log('sth_cari_cinsi:', record.sth_cari_cinsi);
    console.log('sth_adres_no:', record.sth_adres_no);
    console.log('sth_vergisiz_fl:', record.sth_vergisiz_fl);
    console.log('sth_fis_sirano:', record.sth_fis_sirano);
    console.log('sth_taxfree_fl:', record.sth_taxfree_fl);
    console.log('sth_ilave_edilecek_kdv:', record.sth_ilave_edilecek_kdv);
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

checkAllSthFields();
