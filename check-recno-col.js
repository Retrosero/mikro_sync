require('dotenv').config();
const pg = require('./services/postgresql.service');

async function checkSpecific() {
    try {
        const res = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'cari_hesap_hareketleri' AND column_name = 'erp_recno'");
        console.log('Cari Has erp_recno:', res.length > 0);

        const res2 = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'stok_hareketleri' AND column_name = 'erp_recno'");
        console.log('Stok Has erp_recno:', res2.length > 0);
    } catch (e) { console.error(e); }
    finally { await pg.disconnect(); }
}
checkSpecific();
