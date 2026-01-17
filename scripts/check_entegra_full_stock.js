require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkEntegra() {
    try {
        const res = await pgService.query(`
            SELECT * 
            FROM entegra_product 
            WHERE "productCode" = '6056902'
        `);
        if (res.length > 0) {
            const data = res[0];
            // Filter keys that have non-zero/non-null numeric values
            const interesting = {};
            for (let key in data) {
                if (key.toLowerCase().includes('stock') || key.toLowerCase().includes('quantity') || key.toLowerCase().includes('miktar')) {
                    interesting[key] = data[key];
                }
            }
            console.log('Interesting fields in entegra_product:', interesting);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkEntegra();
