require('dotenv').config();
const pg = require('../services/postgresql.service');

async function checkStokColumns() {
    try {
        const res = await pg.query(`
            SELECT column_name, data_type, character_maximum_length, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'stoklar'
            ORDER BY column_name
        `);
        const fs = require('fs');
        fs.writeFileSync('stok_columns_result_utf8.txt', JSON.stringify(res, null, 2), 'utf8');
        console.log('Written to file');
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

checkStokColumns();
