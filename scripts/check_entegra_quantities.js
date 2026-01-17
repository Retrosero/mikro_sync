require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkQuantities() {
    try {
        console.log('PostgreSQL entegra_product_quantity tablosu kontrol ediliyor...');
        const res = await pgService.query(`
            SELECT * 
            FROM entegra_product_quantity 
            WHERE "productCode" = '6056902'
        `);
        console.log('Result:', res);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkQuantities();
