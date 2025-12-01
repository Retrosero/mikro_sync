require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkKasaKodlari() {
    try {
        const kasalar = await pgService.query("SELECT kasa_kodu, kasa_adi, kasa_tipi FROM kasalar");
        console.log('Kasalar:', kasalar);

        const kasalarWithKod = await pgService.query("SELECT COUNT(*) as count FROM kasalar WHERE kasa_kodu IS NOT NULL");
        console.log('Kasalar with kasa_kodu:', kasalarWithKod[0].count);
    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}

checkKasaKodlari();
