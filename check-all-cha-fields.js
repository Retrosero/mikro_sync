require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkAllChaFields() {
  try {
    const evrakNo = process.argv[2] || '4548';
    console.log(`Evrak ${evrakNo} - TÜM CARİ HAREKET ALANLARI\n`);
    
    const query = `
      SELECT *
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrakno_sira = ${evrakNo}
      ORDER BY cha_RECno DESC
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
    console.log('cha_RECno:', record.cha_RECno);
    console.log('cha_evrakno_sira:', record.cha_evrakno_sira);
    console.log('cha_kod:', record.cha_kod);
    console.log('cha_meblag:', record.cha_meblag);
    console.log('cha_tpoz:', record.cha_tpoz);
    console.log('cha_cari_cins:', record.cha_cari_cins);
    console.log('cha_vade:', record.cha_vade);
    console.log('cha_vergisiz_fl:', record.cha_vergisiz_fl);
    console.log('cha_fis_tarih:', record.cha_fis_tarih);
    console.log('cha_reftarihi:', record.cha_reftarihi);
    console.log('cha_vardiya_tarihi:', record.cha_vardiya_tarihi);
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

checkAllChaFields();
