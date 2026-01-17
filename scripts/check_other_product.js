require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkOther() {
    try {
        const res = await mssqlService.query(`
            SELECT
                S.sto_kod,
                S.sto_isim,
                ISNULL(SHM.sth_eldeki_miktar, 0) AS stock
            FROM
                STOKLAR S WITH (NOLOCK)
            LEFT JOIN
                STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW SHM WITH (NOLOCK) ON S.sto_kod = SHM.sth_stok_kod
            WHERE 
                S.sto_kod = '6056930'
        `);
        console.log('Result for 6056930 in Mikro:', res);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkOther();
