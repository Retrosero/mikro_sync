require('dotenv').config();
const pg = require('./services/postgresql.service');

async function checkTables() {
    try {
        const query = `
            SELECT table_name, table_type 
            FROM information_schema.tables 
            WHERE table_name LIKE '%asorti%'
        `;
        const r = await pg.query(query);
        console.table(r);
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
checkTables();
