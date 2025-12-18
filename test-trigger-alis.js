
require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('--- ONE ALIS RECORD ---');
        const res = await pgService.query("SELECT id FROM alislar LIMIT 1");
        if (res.length > 0) {
            const id = res[0].id;
            console.log('Updating Alis ID:', id);

            // Dummy update to trigger sync
            await pgService.query("UPDATE alislar SET updated_at = NOW() WHERE id = $1", [id]);
            console.log('Update executed.');

            // Check queue
            const queueItem = await pgService.query("SELECT * FROM sync_queue WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1", [id]);
            console.log('Queue Item:', queueItem);
        } else {
            console.log('No alis records found.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
})();
