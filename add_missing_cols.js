require('dotenv').config();
const pg = require('./services/postgresql.service');

async function run() {
    try {
        await pg.query("ALTER TABLE satislar ADD COLUMN IF NOT EXISTS belge_no VARCHAR(50)");
        await pg.query("ALTER TABLE iadeler ADD COLUMN IF NOT EXISTS belge_no VARCHAR(50)");
        await pg.query("ALTER TABLE tahsilatlar ADD COLUMN IF NOT EXISTS belge_no VARCHAR(50)");
        console.log('Columns added successfully');
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
run();
