require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkBarcode() {
    try {
        const res = await mssqlService.query(`
            SELECT B.bar_stokkodu, S.sto_isim, B.bar_kodu
            FROM BARKOD_TANIMLARI B WITH (NOLOCK)
            JOIN STOKLAR S ON B.bar_stokkodu = S.sto_kod
            WHERE B.bar_kodu = '6056902'
        `);
        console.log('Barcode Search Result:', res);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkBarcode();
