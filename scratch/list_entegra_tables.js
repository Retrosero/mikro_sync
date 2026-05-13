const pgService = require('../services/postgresql.service');

async function checkTables() {
    try {
        const res = await pgService.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'entegra%'
        `);
        console.table(res);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkTables();
