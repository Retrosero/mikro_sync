require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkCins() {
    const productCode = '6056902';
    try {
        const res = await mssqlService.query(`
            SELECT sth_tip, sth_cins, sth_miktar, sth_create_date
            FROM STOK_HAREKETLERI WITH (NOLOCK)
            WHERE sth_stok_kod = '${productCode}'
        `);
        console.log('Hareketler (cins dahil):', res);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkCins();
