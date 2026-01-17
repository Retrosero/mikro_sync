require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkDates() {
    try {
        const res = await mssqlService.query(`
            SELECT sto_kod, sto_lastup_date 
            FROM MikroDB_V15_04.dbo.STOKLAR 
            WHERE sto_kod = '6056902'
        `);
        console.log('V15_04 Last Update:', res);

        const res2 = await mssqlService.query(`
            SELECT sto_kod, sto_lastup_date 
            FROM MikroDB_V15_02.dbo.STOKLAR 
            WHERE sto_kod = '6056902'
        `);
        console.log('V15_02 Last Update:', res2);

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkDates();
