const mssqlService = require('../services/mssql.service');

async function checkBarkodColumns() {
    try {
        console.log('BARKOD_TANIMLARI tablosu kolonları kontrol ediliyor...\n');

        const result = await mssqlService.query(`
      SELECT TOP 1 * 
      FROM BARKOD_TANIMLARI
    `);

        if (result.length > 0) {
            console.log('Mevcut kolonlar:');
            Object.keys(result[0]).forEach(col => {
                console.log(`  - ${col}`);
            });
        } else {
            console.log('Tabloda veri bulunamadı');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkBarkodColumns();
