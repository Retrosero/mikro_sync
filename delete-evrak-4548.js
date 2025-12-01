require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function deleteEvrak4548() {
  try {
    await mssqlService.connect();
    
    console.log('Evrak 4548 siliniyor...');
    
    // Önce stok hareketlerini sil
    await mssqlService.query(`
      DELETE FROM STOK_HAREKETLERI
      WHERE sth_evrakno_sira = 4548
    `);
    console.log('✓ Stok hareketleri silindi');
    
    // Sonra cari hareketleri sil
    await mssqlService.query(`
      DELETE FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrakno_sira = 4548
    `);
    console.log('✓ Cari hareketleri silindi');
    
    await mssqlService.disconnect();
    console.log('\n✓ Evrak 4548 başarıyla silindi!');
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

deleteEvrak4548();
