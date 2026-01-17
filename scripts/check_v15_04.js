require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkV04() {
    const productCodes = ['6056902', '6056930'];
    const db = 'MikroDB_V15_04';

    try {
        console.log(`${db} detaylı kontrol ediliyor...`);
        const res = await mssqlService.query(`
            SELECT
                S.sto_kod,
                S.sto_isim,
                ISNULL(SHM.sth_eldeki_miktar, 0) AS stock
            FROM
                ${db}.dbo.STOKLAR S WITH (NOLOCK)
            LEFT JOIN
                ${db}.dbo.STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW SHM WITH (NOLOCK) ON S.sto_kod = SHM.sth_stok_kod
            WHERE 
                S.sto_kod IN (${productCodes.map(c => `'${c}'`).join(',')})
        `);
        console.log(`Result for ${db}:`, res);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkV04();
