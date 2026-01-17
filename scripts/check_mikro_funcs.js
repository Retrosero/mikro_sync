require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkFunc() {
    try {
        const res = await mssqlService.query(`SELECT name FROM sys.objects WHERE type IN ('FN', 'IF', 'TF') AND name LIKE '%miktar%'`);
        console.log('Miktar Functions:', res.map(r => r.name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkFunc();
