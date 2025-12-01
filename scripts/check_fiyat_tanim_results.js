require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkFiyatTanimResults() {
    try {
        const fiyatTanimlari = await pgService.query("SELECT sira_no, fiyat_adi, formul, olusturma_tarihi, guncelleme_tarihi FROM fiyat_tanimlari ORDER BY sira_no");
        console.log('Fiyat Tanımları:', fiyatTanimlari);

        const count = await pgService.query("SELECT COUNT(*) as count FROM fiyat_tanimlari");
        console.log('Total Fiyat Tanımları:', count[0].count);
    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}

checkFiyatTanimResults();
