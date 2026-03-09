const pgService = require('./services/postgresql.service');

async function main() {
    try {
        const res = await pgService.query("SELECT id, entity_type, operation, status, record_data FROM sync_queue WHERE entity_type='entegra_pictures' ORDER BY id DESC LIMIT 10");
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
