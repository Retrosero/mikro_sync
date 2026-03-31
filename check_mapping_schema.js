const pg = require('./services/postgresql.service');

async function check() {
    try {
        const result = await pg.query("SELECT * FROM information_schema.table_constraints WHERE table_name = 'int_satis_mapping'");
        console.log(JSON.stringify(result, null, 2));

        const result2 = await pg.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'int_satis_mapping'");
        console.log(JSON.stringify(result2, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

check();
