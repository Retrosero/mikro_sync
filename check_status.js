const pgService = require('./services/postgresql.service');

async function check() {
    try {
        const res = await pgService.query("SELECT * FROM sync_queue WHERE entity_type='stok_hareket' ORDER BY processed_at DESC LIMIT 1");
        console.log(res);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

check();
