require('dotenv').config();
const pg = require('./services/postgresql.service');
async function run() {
    try {
        const table = process.argv[2] || 'user_fatura_ayarlari';
        const columns = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
        console.log(`Table: ${table}`);
        console.log(columns.map(c => c.column_name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
run();
