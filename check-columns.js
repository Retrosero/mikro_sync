require('dotenv').config();
const pg = require('./services/postgresql.service');

async function listCols() {
    try {
        const res = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'cari_hesap_hareketleri'");
        console.log('Cari Cols:', res.map(r => r.column_name).sort().join(', '));

        const res2 = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'stok_hareketleri'");
        console.log('Stok Cols:', res2.map(r => r.column_name).sort().join(', '));
    } catch (e) { console.error(e); }
    finally { await pg.disconnect(); }
}
listCols();
