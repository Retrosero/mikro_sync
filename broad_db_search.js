const pgService = require('./services/postgresql.service');

async function main() {
    try {
        console.log("--- Entegra Pictures (Last 5) ---");
        const res1 = await pgService.query("SELECT * FROM entegra_pictures ORDER BY id DESC LIMIT 5");
        console.log(res1);

        console.log("\n--- Urun Resimleri (Last 5) ---");
        const res2 = await pgService.query("SELECT * FROM urun_resimleri ORDER BY id DESC LIMIT 5");
        console.log(res2);

        console.log("\n--- Sync Queue (Broad) ---");
        const res3 = await pgService.query("SELECT id, entity_type, operation, status, left(record_data::text, 100) as preview FROM sync_queue ORDER BY id DESC LIMIT 50");
        console.log(res3);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
