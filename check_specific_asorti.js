require('dotenv').config();
const pg = require('./services/postgresql.service');

async function check() {
    try {
        const query = `
            SELECT id, stok_kodu, eldeki_miktar, ana_stok_id, is_asorti
            FROM stoklar 
            WHERE stok_kodu = 'PL62315-PEMBE' OR id = (SELECT ana_stok_id FROM stoklar WHERE stok_kodu = 'PL62315-PEMBE')
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
