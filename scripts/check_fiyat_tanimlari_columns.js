require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkFiyatTanimlari() {
    try {
        const cols = await pgService.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'fiyat_tanimlari'");
        console.log('Fiyat Tanimlari Columns:', cols.map(c => c.column_name));
    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}

checkFiyatTanimlari();
