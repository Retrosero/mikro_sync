const pgService = require('./services/postgresql.service');

async function debug() {
    try {
        console.log('--- Failed Queue Items ---');
        const failed = await pgService.query("SELECT * FROM sync_queue WHERE entity_type='stok_hareket' AND status='failed'");
        console.log(failed);

        if (failed.length > 0) {
            const entityId = failed[0].entity_id;
            console.log('\n--- Web Record ---');
            const webRecord = await pgService.query("SELECT * FROM stok_hareketleri WHERE id = $1", [entityId]);
            console.log(webRecord);
        }

        console.log('\n--- Duplicate Check ---');
        // Check if there are many records with same erp_recno (especially 0)
        const dups = await pgService.query("SELECT erp_recno, COUNT(*) FROM stok_hareketleri WHERE erp_recno IS NOT NULL GROUP BY erp_recno HAVING COUNT(*) > 1");
        console.log('Duplicates:', dups);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

debug();
