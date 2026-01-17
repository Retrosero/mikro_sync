require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkStoklarTable() {
    try {
        const columns = await mssqlService.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'STOKLAR'
            AND COLUMN_NAME LIKE '%miktar%'
        `);
        console.log('STOKLAR Miktar Columns:', columns.map(c => c.COLUMN_NAME).join(', '));

        const res = await mssqlService.query(`
            SELECT sto_kod, sto_isim, * 
            FROM STOKLAR WITH (NOLOCK)
            WHERE sto_kod = '6056902'
        `);
        console.log('STOKLAR Result:', res);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkStoklarTable();
