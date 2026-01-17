require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkAllDBs() {
    const productCode = '6056902';
    try {
        const dbsRes = await mssqlService.query(`SELECT name FROM sys.databases WHERE name LIKE 'MikroDB%'`);
        const dbs = dbsRes.map(r => r.name);

        for (const db of dbs) {
            try {
                const res = await mssqlService.query(`SELECT ISNULL(SUM(sth_miktar * CASE WHEN sth_tip=0 THEN 1 ELSE -1 END), 0) as stock FROM ${db}.dbo.STOK_HAREKETLERI WHERE sth_stok_kod = '${productCode}'`);
                console.log(`${db}: ${res[0]?.stock || 0}`);
            } catch (e) { }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkAllDBs();
