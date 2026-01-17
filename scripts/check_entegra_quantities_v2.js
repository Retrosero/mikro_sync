require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkQuantities() {
    try {
        const columns = await pgService.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_product_quantity'
        `);
        console.log('Columns:', columns.map(c => c.column_name).join(', '));

        const res = await pgService.query(`
            SELECT * 
            FROM entegra_product_quantity 
            LIMIT 5
        `);
        console.log('Sample Data:', res);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkQuantities();
