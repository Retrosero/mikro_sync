const mssqlService = require('../services/mssql.service');

async function checkErpColumns() {
    try {
        const result = await mssqlService.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'STOK_HAREKETLERI'
    `);

        console.log('STOK_HAREKETLERI Columns:');
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
