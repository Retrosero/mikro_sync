require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function listColumns() {
    try {
        const res = await mssqlService.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'STOK_HAREKETLERI'
        `);
        console.log('STOK_HAREKETLERI Columns:', res.map(r => r.COLUMN_NAME).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

listColumns();
