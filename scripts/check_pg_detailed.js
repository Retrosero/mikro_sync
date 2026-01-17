require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkPGDetailed() {
    try {
        const res = await pgService.query('SELECT * FROM xmlurunler WHERE product_code = $1', ['6056902']);
        console.log('xmlurunler Detailed:', res);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkPGDetailed();
