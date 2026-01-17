require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkDuplicates() {
    const productCode = '6056902';
    try {
        const res = await mssqlService.query(`SELECT COUNT(*) as cnt FROM STOKLAR WHERE sto_kod = '${productCode}'`);
        console.log(`Duplicate count for ${productCode}:`, res[0].cnt);

        if (res[0].cnt > 1) {
            const details = await mssqlService.query(`SELECT sto_RECno, sto_kod, sto_isim, sto_create_date FROM STOKLAR WHERE sto_kod = '${productCode}'`);
            console.log('Duplicate Details:', details);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkDuplicates();
