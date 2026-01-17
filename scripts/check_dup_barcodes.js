require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkDupBarcodes() {
    const barcode = '778988307151';
    try {
        console.log(`Aynı barkoda sahip diğer ürünler: ${barcode}`);
        const res = await mssqlService.query(`SELECT * FROM BARKOD_TANIMLARI WHERE bar_kodu = '${barcode}'`);
        console.log('Sonuç:', res);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkDupBarcodes();
