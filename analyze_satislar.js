const pg = require('./services/postgresql.service');

async function analyze() {
    try {
        console.log('--- Columns in satislar ---');
        const cols = await pg.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'satislar'");
        console.log(JSON.stringify(cols, null, 2));

        console.log('\n--- Triggers in satislar ---');
        const triggers = await pg.query("SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'satislar'");
        console.log(JSON.stringify(triggers, null, 2));

        console.log('\n--- Constraints in satislar ---');
        const constraints = await pg.query("SELECT * FROM information_schema.table_constraints WHERE table_name = 'satislar'");
        console.log(JSON.stringify(constraints, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

analyze();
