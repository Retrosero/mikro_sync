
require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        const id = '9e6369a3-6957-4e50-b8c6-4a0244668ddc'; // Queue ID from previous step output
        await pgService.query("DELETE FROM sync_queue WHERE id = $1", [id]);
        console.log('Test queue item deleted:', id);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
})();
