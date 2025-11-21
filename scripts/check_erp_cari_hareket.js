const mssqlService = require('../services/mssql.service');

async function checkErpColumns() {
    try {
        const result = await mssqlService.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'CARI_HESAP_HAREKETLERI'
    `);

        console.log('CARI_HESAP_HAREKETLERI Columns:');
        result.forEach(row => {
            console.log(row.COLUMN_NAME);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkErpColumns();
