require('dotenv').config();
const pg = require('./services/postgresql.service');

async function checkType() {
    try {
        const res = await pg.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'cari_hesap_hareketleri' AND column_name = 'erp_recno'");
        if (res.length > 0) console.log('Type:', res[0].data_type);
        else console.log('Column not found');
    } catch (e) { console.error(e); }
    finally { await pg.disconnect(); }
}
checkType();
