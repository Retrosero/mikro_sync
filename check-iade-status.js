
require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('--- SYNC QUEUE SUMMARY ---');
        const summary = await pgService.query("SELECT status, count(*) FROM sync_queue GROUP BY status");
        console.table(summary);

        console.log('\n--- PENDING / FAILED ITEMS ---');
        const items = await pgService.query("SELECT id, entity_type, entity_id, status, error_message, created_at FROM sync_queue WHERE status IN ('pending', 'failed') ORDER BY created_at DESC");

        if (items.length > 0) {
            items.forEach(item => {
                console.log(`[${item.status}] Type: ${item.entity_type}, ID: ${item.entity_id}, Error: ${item.error_message}`);
            });
        } else {
            console.log('No pending or failed items.');
        }

        console.log('\n--- RECENT COMPLETED IADE ITEMS ---');
        // İade olabilecekleri tahmin etmeye çalışalım (alislar tablosunda fatura_tipi='iade' olanlar)
        const recentIades = await pgService.query(`
            SELECT 
                sq.id as queue_id, 
                sq.status, 
                a.fatura_tipi, 
                a.iade,
                sq.updated_at
            FROM sync_queue sq
            JOIN alislar a ON sq.entity_id::text = a.id::text
            WHERE sq.entity_type = 'alis' OR sq.entity_type = 'alislar'
            ORDER BY sq.updated_at DESC
            LIMIT 5
        `);
        console.table(recentIades);


    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
})();
