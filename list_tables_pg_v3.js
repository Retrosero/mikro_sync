require('dotenv').config();
const fs = require('fs');
const pg = require('./services/postgresql.service');
async function run() {
    try {
        const tables = await pg.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        fs.writeFileSync('pg_tables.txt', tables.map(t => t.table_name).join('\n'));
        console.log('Saved to pg_tables.txt');
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
run();
