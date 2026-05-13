require('dotenv').config();
const pg = require('./services/postgresql.service');

async function checkCols() {
    try {
        const query = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stoklar' 
              AND (column_name LIKE '%miktar%' OR column_name LIKE '%stok%' OR column_name LIKE '%adet%')
        `;
        const r = await pg.query(query);
        console.table(r);
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
checkCols();
