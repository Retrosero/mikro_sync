require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkMaxEvrak() {
  try {
    await mssqlService.connect();
    
    const result = await mssqlService.query(`
      SELECT MAX(cha_evrakno_sira) as max_evrak
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrak_tip = 63 AND cha_evrakno_seri = ''
    `);
    
    console.log('Max evrak numarası:', result[0].max_evrak);
    console.log('Yeni evrak numarası olacak:', (result[0].max_evrak || 0) + 1);
    
    await mssqlService.disconnect();
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

checkMaxEvrak();
