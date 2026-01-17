require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkProduct() {
    try {
        const res = await pgService.query(`
            SELECT * 
            FROM entegra_product 
            WHERE "productCode" = '6056902'
        `);
        if (res.length > 0) {
            console.log('Product Data:', JSON.stringify(res[0], null, 2));
        } else {
            console.log('Product not found in Entegra table.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkProduct();
