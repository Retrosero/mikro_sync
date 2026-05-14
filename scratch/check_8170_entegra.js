require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkEntegra() {
    const code = '8170';
    try {
        console.log('--- PG entegra_product ---');
        const res = await pgService.query(`
            SELECT "productCode", quantity
            FROM entegra_product
            WHERE "productCode" = $1 OR "productCode" LIKE $2
        `, [code, `%${code}%`]);
        console.log('Results:', JSON.stringify(res, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkEntegra();
