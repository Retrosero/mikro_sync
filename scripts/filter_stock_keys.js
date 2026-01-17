require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function listStockKeys() {
    try {
        const res = await pgService.query(`
            SELECT * 
            FROM entegra_product 
            LIMIT 1
        `);
        const keys = Object.keys(res[0]);
        const stockKeys = keys.filter(k => k.toLowerCase().includes('stock') || k.toLowerCase().includes('quantity') || k.toLowerCase().includes('miktar'));
        console.log('Stock/Quantity Related Keys:', stockKeys.sort());

        // Let's also check if there is an 'inventory' or 'stok'
        const otherKeys = keys.filter(k => k.toLowerCase().includes('stok') || k.toLowerCase().includes('inventory'));
        console.log('Stok/Inventory Related Keys:', otherKeys.sort());

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

listStockKeys();
