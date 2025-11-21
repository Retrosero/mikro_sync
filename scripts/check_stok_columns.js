const mssqlService = require('../services/mssql.service');

async function checkStokColumns() {
    try {
        console.log('STOKLAR tablosu kolonları kontrol ediliyor...\n');

        const columns = await mssqlService.query(`
      SELECT TOP 1 * FROM STOKLAR
    `);

        if (columns.length > 0) {
            console.log('Mevcut kolonlar:');
            console.log(Object.keys(columns[0]).join(', '));
            console.log('\nÖrnek veri:');
            console.log(columns[0]);
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkStokColumns();
