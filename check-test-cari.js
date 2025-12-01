require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkTestCari() {
  try {
    const cariId = 'db2a3f57-015a-41cf-b846-4801e301a96d';
    
    console.log('Test cari kontrol ediliyor...\n');
    
    // Cari bilgisi
    const cari = await pgService.queryOne(`
      SELECT * FROM cari_hesaplar WHERE id = $1
    `, [cariId]);
    
    console.log('Cari bilgisi:');
    console.log(cari);
    console.log();
    
    // Mapping var mı?
    const mapping = await pgService.queryOne(`
      SELECT * FROM int_kodmap_cari WHERE web_cari_id = $1
    `, [cariId]);
    
    console.log('Mapping:');
    console.log(mapping || 'YOK!');
    console.log();
    
    // Bu cari kodu için başka mapping var mı?
    if (cari) {
      const otherMapping = await pgService.queryOne(`
        SELECT m.*, c.cari_adi
        FROM int_kodmap_cari m
        JOIN cari_hesaplar c ON c.id = m.web_cari_id
        WHERE m.erp_cari_kod = $1
      `, [cari.cari_kodu]);
      
      console.log(`"${cari.cari_kodu}" için başka mapping:`);
      console.log(otherMapping || 'YOK!');
    }

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await pgService.disconnect();
    process.exit(0);
  }
}

checkTestCari();
