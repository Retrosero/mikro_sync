require('dotenv').config();
const pg = require('./services/postgresql.service');

async function checkEntegraCols() {
    try {
        const res = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'entegra_product'");
        console.log('entegra_product columns:', res.map(c => c.column_name));

        const res2 = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'entegra_pictures'");
        console.log('entegra_pictures columns:', res2.map(c => c.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

checkEntegraCols();
