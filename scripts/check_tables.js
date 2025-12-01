require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkTables() {
    try {
        const tables = await pgService.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('kasalar', 'bankalar')");
        console.log('Existing Tables:', tables.map(t => t.table_name));

        if (tables.find(t => t.table_name === 'bankalar')) {
            const bankaCols = await pgService.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bankalar'");
            console.log('Bankalar Columns:', bankaCols.map(c => c.column_name));
        }

        const cariCols = await pgService.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'cari_hesap_hareketleri'");
        console.log('Cari Hareket Columns:', cariCols.map(c => c.column_name));

    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}

checkTables();
