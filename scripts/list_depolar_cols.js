require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function listDepoCols() {
    try {
        const res = await mssqlService.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'DEPOLAR'`);
        console.log('DEPOLAR Columns:', res.map(r => r.COLUMN_NAME).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

listDepoCols();
