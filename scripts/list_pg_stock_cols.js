require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function listStockColumns() {
    try {
        const res = await pgService.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_product'
            AND (column_name LIKE '%stock%' OR column_name LIKE '%quantity%' OR column_name LIKE '%miktar%')
        `);
        console.log('Stock Related Columns:', res.map(r => r.column_name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

listStockColumns();
