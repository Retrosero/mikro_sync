require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkFnEldeki() {
    const productCode = '6056902';
    try {
        const res = await mssqlService.query(`SELECT dbo.fn_EldekiMiktar('${productCode}') as miktar`);
        console.log('fn_EldekiMiktar Sonucu:', res[0].miktar);

        const res2 = await mssqlService.query(`SELECT * FROM STOK_HAREKETLERI_OZET WHERE sho_StokKodu = '${productCode}'`);
        console.log('STOK_HAREKETLERI_OZET Detay:', res2);

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkFnEldeki();
