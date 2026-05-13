require('dotenv').config();
const pg = require('./services/postgresql.service');

async function check() {
    try {
        const r = await pg.query('SELECT "productCode", "productName", id FROM entegra_product LIMIT 10');
        console.table(r);
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
check();
