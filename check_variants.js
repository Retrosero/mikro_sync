require('dotenv').config();
const pg = require('./services/postgresql.service');

async function check() {
    try {
        const query = `
            SELECT s.stok_kodu, s.eldeki_miktar as web_q, eq.quantity as ent_q, s.ana_stok_id
            FROM stoklar s
            JOIN entegra_product ep ON s.stok_kodu = ep."productCode"
            JOIN entegra_product_quantity eq ON ep.id = eq.product_id
            WHERE s.eldeki_miktar = 0 AND eq.quantity > 0
            LIMIT 20;
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
