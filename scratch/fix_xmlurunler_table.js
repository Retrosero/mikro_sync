require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function fixTable() {
    try {
        console.log('Adding unique constraint to xmlurunler(product_code)...');
        await pgService.query(`
            ALTER TABLE xmlurunler ADD CONSTRAINT xmlurunler_product_code_key UNIQUE (product_code);
        `);
        console.log('Success!');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

fixTable();
