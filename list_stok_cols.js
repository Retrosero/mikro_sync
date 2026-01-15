const pg = require('./services/postgresql.service');

async function listColumns() {
    try {
        const res = await pg.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stoklar'
            ORDER BY column_name
        `);
        console.log(res);
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

listColumns();
