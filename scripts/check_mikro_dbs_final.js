require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkFinal() {
    const productCode = '6056902';
    const dbs = ['MikroDB_V15', 'MikroDB_V15_02', 'MikroDB_V15_03', 'MikroDB_V15_04'];

    for (const db of dbs) {
        try {
            const res = await mssqlService.query(`
                SELECT ISNULL(SUM(sth_miktar * CASE WHEN sth_tip=0 THEN 1 ELSE -1 END), 0) as stock 
                FROM ${db}.dbo.STOK_HAREKETLERI 
                WHERE sth_stok_kod = '${productCode}'
            `);
            console.log(`${db}: ${res[0].stock}`);
        } catch (e) {
            console.log(`${db} (error): ${e.message}`);
        }
    }
    await mssqlService.disconnect();
}

checkFinal();
