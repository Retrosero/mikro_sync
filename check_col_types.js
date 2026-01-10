require('dotenv').config();
const pg = require('./services/postgresql.service');

async function checkType() {
    try {
        const res = await pg.query("SELECT column_name, udt_name FROM information_schema.columns WHERE table_name = 'xmlurunler' AND column_name IN ('images', 'images1')");
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

checkType();
