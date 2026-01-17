require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function countV04() {
    try {
        const res = await mssqlService.query(`SELECT COUNT(*) as cnt FROM MikroDB_V15_04.dbo.STOKLAR`);
        console.log('Product Count in V15_04:', res[0].cnt);

        const res2 = await mssqlService.query(`SELECT COUNT(*) as cnt FROM MikroDB_V15_02.dbo.STOKLAR`);
        console.log('Product Count in V15_02:', res2[0].cnt);

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

countV04();
