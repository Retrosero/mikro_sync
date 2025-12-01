require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkOzetTable() {
  try {
    console.log('STOK_HAREKETLERI_OZET tablosu kontrol ediliyor...\n');
    
    const ozet = await mssqlService.query(`
      SELECT TOP 5 *
      FROM STOK_HAREKETLERI_OZET
    `);
    
    console.log(`Özet kayıtları: ${ozet.length}\n`);
    if (ozet.length > 0) {
      console.log('İlk kayıt kolonları:');
      console.log(Object.keys(ozet[0]));
      console.log('\nİlk kayıt:');
      console.log(ozet[0]);
    }
    
    // Kolon adlarını öğrendikten sonra silme işlemi yapılacak

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await mssqlService.disconnect();
    process.exit(0);
  }
}

checkOzetTable();
