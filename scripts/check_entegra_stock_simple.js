require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkStock() {
    try {
        const res = await pgService.query(`
            SELECT "productCode", "quantity", "stock" 
            FROM entegra_product 
            WHERE "productCode" = '6056902'
        `);
        console.log('Result:', res);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkStock();
