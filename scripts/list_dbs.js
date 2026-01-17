require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function listDBs() {
    try {
        const res = await mssqlService.query(`SELECT name FROM sys.databases`);
        console.log('Databases:', res.map(r => r.name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

listDBs();
