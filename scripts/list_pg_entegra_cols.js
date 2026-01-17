require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function listPGColumns() {
    try {
        const res = await pgService.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_product'
        `);
        console.log('entegra_product Columns:', res.map(r => r.column_name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

listPGColumns();
