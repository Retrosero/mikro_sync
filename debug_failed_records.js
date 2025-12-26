const pgService = require('./services/postgresql.service');

async function checkFailedRecords() {
    try {
        const ids = [
            '1cb80e00-4cd7-45d7-941b-193ef73e1044',
            '6fc0c003-4cbf-4331-869f-d82565d2165b' // Partial ID from log, might not work if not full
        ];

        // Get full list of failed/pending
        const queue = await pgService.query("SELECT * FROM sync_queue WHERE status IN ('failed', 'pending') AND entity_type='stok_hareket'");
        console.log('Queue Items:', queue);

        if (queue.length > 0) {
            const entityIds = queue.map(q => q.entity_id);
            const records = await pgService.query("SELECT id, fatura_seri_no, fatura_sira_no, belge_no, aciklama FROM stok_hareketleri WHERE id = ANY($1)", [entityIds]);
            console.log('Stok Hareket Records:', records);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkFailedRecords();
