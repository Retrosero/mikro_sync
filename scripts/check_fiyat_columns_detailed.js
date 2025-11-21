const mssqlService = require('../services/mssql.service');

async function checkFiyatColumns() {
    try {
        console.log('STOK_SATIS_FIYAT_LISTELERI tablosu kolonları kontrol ediliyor...\n');

        const result = await mssqlService.query(`
      SELECT TOP 1 * 
      FROM STOK_SATIS_FIYAT_LISTELERI
    `);

        if (result.length > 0) {
            console.log('Mevcut kolonlar:');
            Object.keys(result[0]).forEach(col => {
                console.log(`  - ${col}`);
            });

            console.log('\nÖrnek veri:');
            console.log(result[0]);
        } else {
            console.log('Tabloda veri bulunamadı');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkFiyatColumns();
