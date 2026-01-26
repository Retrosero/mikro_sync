require('dotenv').config();
const pg = require('./services/postgresql.service');
async function run() {
    try {
        const tables = await pg.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(JSON.stringify(tables, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
run();
