require('dotenv').config();
const pg = require('./services/postgresql.service');
async function run() {
    try {
        const table = process.argv[2] || 'user_fatura_ayarlari';
        const columns = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY column_name", [table]);
        columns.forEach(c => console.log(c.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
run();
