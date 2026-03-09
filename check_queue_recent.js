const pgService = require('./services/postgresql.service');

async function main() {
    try {
        const res = await pgService.query("SELECT id, entity_type, operation, status, left(record_data::text, 200) as preview FROM sync_queue ORDER BY id DESC LIMIT 20");
        console.log("Most recent 20 queue entries:");
        console.log(res);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
