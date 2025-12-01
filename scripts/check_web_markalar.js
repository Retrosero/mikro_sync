require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkMarkalar() {
    try {
        const markalar = await pgService.query("SELECT id, marka_adi FROM markalar WHERE aktif = true ORDER BY marka_adi");
        console.log('Web Markalar:', markalar);
        console.log('Total:', markalar.length);
    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}

checkMarkalar();
