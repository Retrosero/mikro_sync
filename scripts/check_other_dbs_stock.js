require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkOtherDBs() {
    const dbs = ['MikroDB_V15_03', 'MikroDB_V15_04'];
    const productCode = '6056902';

    for (const db of dbs) {
        try {
            console.log(`${db} kontrol ediliyor...`);
            const res = await mssqlService.query(`
                SELECT
                    S.sto_kod,
                    ISNULL(SHM.sth_eldeki_miktar, 0) AS stock
                FROM
                    ${db}.dbo.STOKLAR S WITH (NOLOCK)
                LEFT JOIN
                    ${db}.dbo.STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW SHM WITH (NOLOCK) ON S.sto_kod = SHM.sth_stok_kod
                WHERE 
                    S.sto_kod = '${productCode}'
            `);
            console.log(`Result for ${db}:`, res);
        } catch (e) {
            console.log(`${db} hatası: ${e.message}`);
        }
    }
    await mssqlService.disconnect();
}

checkOtherDBs();
