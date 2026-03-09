const pgService = require('./services/postgresql.service');

async function main() {
    try {
        const res = await pgService.query("SELECT id, entity_type, operation, status, left(record_data::text, 100) as preview FROM sync_queue ORDER BY created_at DESC LIMIT 100");
        const found = res.filter(r =>
            JSON.stringify(r).toLowerCase().includes('resim') ||
            JSON.stringify(r).toLowerCase().includes('picture') ||
            JSON.stringify(r).toLowerCase().includes('image')
        );
        console.log("Filtered Search Results (last 100):");
        console.log(found);

        const pending = res.filter(r => r.status === 'pending');
        console.log("\nPending items in last 100:");
        console.log(pending);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
