require('dotenv').config();
const pg = require('./services/postgresql.service');

async function check() {
    try {
        console.log('Checking Cari Hareket 71791...');
        const cari = await pg.query('SELECT id, erp_recno, created_at FROM cari_hesap_hareketleri WHERE erp_recno = $1', [71791]);
        console.log('Cari Count:', cari.length);
        if (cari.length > 0) console.log(cari[0]);

        console.log('Checking Stok Hareket 136873, 136874...');
        const stok = await pg.query('SELECT id, erp_recno, created_at FROM stok_hareketleri WHERE erp_recno IN ($1, $2)', [136873, 136874]);
        console.log('Stok Count:', stok.length);
        if (stok.length > 0) console.log(stok);

        // Check column types
        console.log('Checking Schema...');
        const schema = await pg.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE column_name = 'erp_recno' AND table_name IN ('cari_hesap_hareketleri', 'stok_hareketleri')");
        console.log(schema);

    } catch (e) { console.error(e); }
    finally { await pg.disconnect(); }
}
check();
