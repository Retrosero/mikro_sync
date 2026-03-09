const pgService = require('./services/postgresql.service');

async function main() {
    try {
        const res = await pgService.query("SELECT id, entity_type, operation, status FROM sync_queue WHERE entity_type='entegra_pictures' ORDER BY id DESC LIMIT 5");
        console.log("Entegra Pictures records in queue:");
        console.log(res);

        if (res.length > 0) {
            const detail = await pgService.query("SELECT record_data FROM sync_queue WHERE id=$1", [res[0].id]);
            console.log("Sample Payload Data:");
            console.log(JSON.stringify(detail[0].record_data, null, 2));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
