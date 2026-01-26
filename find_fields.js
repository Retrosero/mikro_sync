require('dotenv').config();
const pg = require('./services/postgresql.service');
async function run() {
    try {
        const table = 'user_fatura_ayarlari';
        const columns = await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
        const matched = columns.filter(c =>
            c.column_name.includes('seri') ||
            c.column_name.includes('sira') ||
            c.column_name.includes('satis') ||
            c.column_name.includes('alis') ||
            c.column_name.includes('iade') ||
            c.column_name.includes('tahsilat') ||
            c.column_name.includes('tediye') ||
            c.column_name.includes('sayim')
        );
        console.log(matched.map(c => c.column_name).join('\n'));
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
run();
