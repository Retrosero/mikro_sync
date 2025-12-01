require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function cleanTestData() {
  try {
    console.log('Test verileri temizleniyor...\n');
    
    // Test evrak numarası 4548'i sil
    await mssqlService.query(`
      DELETE FROM STOK_HAREKETLERI 
      WHERE sth_evrakno_sira >= 4548
    `);
    
    console.log(`✓ Stok hareketleri silindi`);
    
    // Cari hesap hareketlerini de sil
    await mssqlService.query(`
      DELETE FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrakno_sira >= 4548
    `);
    
    console.log(`✓ Cari hareketler silindi`);
    
    console.log('\n✓ Test verileri temizlendi');

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await mssqlService.disconnect();
    process.exit(0);
  }
}

cleanTestData();
