require('dotenv').config();
const pg = require('./services/postgresql.service');

async function checkData() {
    try {
        const cari = await pg.query("SELECT id, erp_recno FROM cari_hesap_hareketleri WHERE erp_recno = 71791");
        console.log('Cari 71791 Found:', cari.length > 0);

        const stok = await pg.query("SELECT id, erp_recno FROM stok_hareketleri WHERE erp_recno IN (136873, 136874)");
        console.log('Stok 136873/136874 Found:', stok.length > 0);
        if (stok.length > 0) console.log('Found Stok IDs:', stok.map(s => s.id));

    } catch (e) { console.error(e); }
    finally { await pg.disconnect(); }
}
checkData();
