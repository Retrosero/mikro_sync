require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkERP() {
    try {
        const bankalar = await mssqlService.query("SELECT TOP 10 ban_kod, ban_ismi FROM BANKALAR");
        console.log('ERP Bankalar:', bankalar);

        const hareketler = await mssqlService.query("SELECT TOP 10 cha_kasa_hizkod FROM CARI_HESAP_HAREKETLERI WHERE cha_kasa_hizkod IS NOT NULL");
        console.log('ERP Hareketler with Kasa Hizkod:', hareketler);

        const countHareket = await mssqlService.query("SELECT COUNT(*) as count FROM CARI_HESAP_HAREKETLERI WHERE cha_kasa_hizkod IS NOT NULL");
        console.log('Total Hareket with Kasa Hizkod:', countHareket[0].count);

    } catch (error) {
        console.error(error);
    } finally {
        await mssqlService.disconnect();
    }
}

checkERP();
