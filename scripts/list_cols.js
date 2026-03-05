require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function listCols() {
    try {
        const result = await pgService.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_order'
            ORDER BY column_name
        `);
        console.log(result.map(c => c.column_name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

listCols();
