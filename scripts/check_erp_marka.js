require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkErpMarka() {
    try {
        const stoklar = await mssqlService.query("SELECT TOP 5 sto_kod, sto_isim, sto_marka_kodu FROM STOKLAR WHERE sto_marka_kodu IS NOT NULL");
        console.log('ERP Stoklar with Marka:', stoklar);

        // MARKALAR tablosu var mı kontrol et
        const markalar = await mssqlService.query("SELECT TOP 5 * FROM MARKALAR");
        console.log('ERP Markalar:', markalar);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkErpMarka();
