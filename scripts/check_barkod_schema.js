const mssqlService = require('../services/mssql.service');

async function getSchema() {
    try {
        const result = await mssqlService.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'BARKOD_TANIMLARI'
    `);

        console.log('BARKOD_TANIMLARI Kolonları:');
        result.forEach(row => {
            console.log(row.COLUMN_NAME);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

getSchema();
