const pgService = require('./services/postgresql.service');

async function checkSchema() {
    try {
        await pgService.pool.connect();

        console.log("--- satislar columns ---");
        const satisCols = await pgService.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'satislar'");
        console.log(satisCols.map(c => c.column_name).join(', '));

        console.log("\n--- tahsilatlar columns ---");
        const tahsilatCols = await pgService.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tahsilatlar'");
        console.log(tahsilatCols.map(c => c.column_name).join(', '));

        console.log("\n--- alislar columns ---");
        const alisCols = await pgService.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'alislar'");
        console.log(alisCols.map(c => c.column_name).join(', '));

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkSchema();
