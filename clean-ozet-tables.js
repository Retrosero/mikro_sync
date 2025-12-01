require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function cleanOzetTables() {
  try {
    await mssqlService.connect();
    
    console.log('Özet tabloları temizleniyor...');
    
    // Stok hareketleri özet tablosunu temizle
    await mssqlService.query(`
      DELETE FROM STOK_HAREKETLERI_OZET
      WHERE sho_StokKodu = '0138-9' AND sho_MaliYil = 2025 AND sho_Donem = 11
    `);
    console.log('✓ STOK_HAREKETLERI_OZET temizlendi');
    
    // Cari hesap hareketleri özet tablosunu temizle
    await mssqlService.query(`
      DELETE FROM CARI_HESAP_HAREKETLERI_OZET
      WHERE cho_CariKodu = 'PKR-MY HOME' AND cho_MaliYil = 2025 AND cho_Donem = 11
    `);
    console.log('✓ CARI_HESAP_HAREKETLERI_OZET temizlendi');
    
    await mssqlService.disconnect();
    console.log('\n✓ Özet tabloları başarıyla temizlendi!');
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

cleanOzetTables();
