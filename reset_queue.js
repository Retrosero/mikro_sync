const pgService = require('./services/postgresql.service');

async function fix() {
    try {
        console.log('Resetting failed sync_queue items...');
        await pgService.query("UPDATE sync_queue SET status = 'pending', retry_count = 0 WHERE status = 'failed' AND entity_type = 'stok_hareket'");
        console.log('Reset done.');

        console.log('Checking for existing erp_recno conflicts...');
        const res = await pgService.query("SELECT id, erp_recno FROM stok_hareketleri WHERE erp_recno IS NOT NULL ORDER BY erp_recno DESC LIMIT 5");
        console.log('Last 5 erp_recno:', res);

        // Check if there is any record with erp_recno = 0 or 1 which might be default
        const lowRecs = await pgService.query("SELECT id, erp_recno FROM stok_hareketleri WHERE erp_recno < 100");
        console.log('Low erp_recno records:', lowRecs);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

fix();
