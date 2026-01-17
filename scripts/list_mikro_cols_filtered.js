require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function listColumns() {
    try {
        const res = await mssqlService.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'STOK_HAREKETLERI'
            AND (COLUMN_NAME LIKE '%tip%' OR COLUMN_NAME LIKE '%gir%' OR COLUMN_NAME LIKE '%cik%' OR COLUMN_NAME LIKE '%miktar%')
        `);
        console.log('Filtered Columns:', res.map(r => r.COLUMN_NAME).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

listColumns();
