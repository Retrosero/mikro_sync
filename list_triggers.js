const pg = require('./services/postgresql.service');

async function checkTriggers() {
    try {
        const result = await pg.query(`
            SELECT trigger_name, event_manipulation, action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'satislar'
        `);
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkTriggers();
