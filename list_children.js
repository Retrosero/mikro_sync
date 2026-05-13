require('dotenv').config();
const pg = require('./services/postgresql.service');

async function check() {
    try {
        const query = `
            SELECT stok_kodu, eldeki_miktar, is_asorti 
            FROM stoklar 
            WHERE ana_stok_id = '2cae1e00-1166-41c8-9bae-e98e5d37ae73'
        `;
        const r = await pg.query(query);
        console.table(r);
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
check();
