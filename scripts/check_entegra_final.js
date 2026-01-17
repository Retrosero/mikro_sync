require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkFinal() {
    try {
        const res = await pgService.query(`
            SELECT ep.id, ep."productCode", eq.quantity, eq.supplier
            FROM entegra_product ep
            LEFT JOIN entegra_product_quantity eq ON ep.id::text = eq.product_id::text
            WHERE ep."productCode" = '6056902'
        `);
        console.log('Final Result for 6056902:', res);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkFinal();
