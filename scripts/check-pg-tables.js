require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkTables() {
    try {
        const result = await pgService.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const tables = result.map(r => r.table_name);
        console.log('Tables:', tables);

        const barcodeTable = tables.find(t => t.includes('barkod'));
        console.log('Barcode Table:', barcodeTable);

        await pgService.disconnect();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkTables();
