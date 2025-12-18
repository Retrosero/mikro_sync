
require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('--- SYNC QUEUE COLUMNS ---');
        const res = await pgService.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sync_queue'");
        console.log(res.map(r => r.column_name));

        console.log('\n--- IADE FATURALARI (ALISLAR) ---');
        // iade=true veya fatura_tipi='iade' olan alışları listele
        const iades = await pgService.query("SELECT id, fatura_tipi, iade, created_at FROM alislar WHERE fatura_tipi = 'iade' OR iade = true LIMIT 5");
        console.table(iades);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
})();
