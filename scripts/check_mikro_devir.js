require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkDevir() {
    const productCode = '6056902';
    try {
        console.log(`Mikro (V15_02) Cins 9 (Devir) Kontrolü: ${productCode}`);
        const res = await mssqlService.query(`
            SELECT * 
            FROM STOK_HAREKETLERI WITH (NOLOCK)
            WHERE sth_stok_kod = '${productCode}' AND sth_cins = 9
        `);
        console.log('Devir Hareketleri:', res);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkDevir();
