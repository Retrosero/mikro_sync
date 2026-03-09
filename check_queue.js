const pgService = require('./services/postgresql.service');

async function main() {
    try {
        const res = await pgService.query("SELECT id, entity_type, operation, split_part(record_data::text, ',', 5) as preview FROM sync_queue WHERE record_data::text ILIKE '%resim%' OR record_data::text ILIKE '%picture%' OR record_data::text ILIKE '%image%' ORDER BY id DESC LIMIT 10");
        console.log("Found records with picture info in payload:");
        console.log(res);

        // Also check if any other tables have picture updates pending
        const res2 = await pgService.query("SELECT id, entity_type, operation FROM sync_queue WHERE status = 'pending' ORDER BY id DESC LIMIT 10");
        console.log("\nPending records in general:");
        console.log(res2);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
