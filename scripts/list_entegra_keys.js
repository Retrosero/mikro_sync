require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function listKeys() {
    try {
        const res = await pgService.query(`
            SELECT * 
            FROM entegra_product 
            LIMIT 1
        `);
        console.log('Keys:', Object.keys(res[0]).sort());
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

listKeys();
