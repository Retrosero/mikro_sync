const pgService = require('./services/postgresql.service');

async function main() {
    try {
        // Tüm sync_queue kayıtlarını kontrol et
        const all = await pgService.query(`SELECT status, entity_type, COUNT(*) as count FROM sync_queue GROUP BY status, entity_type ORDER BY status, entity_type`);
        console.log('Tüm sync_queue kayıtları:');
        console.table(all);

        // Son 10 failed kayıt
        const failed = await pgService.query(`SELECT id, entity_type, entity_id, operation, status, retry_count, error_message, created_at FROM sync_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10`);
        console.log('\nSon 10 failed kayıt:');
        console.table(failed);

        // Son 10 pending kayıt
        const pending = await pgService.query(`SELECT id, entity_type, entity_id, operation, status, retry_count, created_at FROM sync_queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10`);
        console.log('\nSon 10 pending kayıt:');
        console.table(pending);

        // Son 10 processing kayıt
        const processing = await pgService.query(`SELECT id, entity_type, entity_id, operation, status, retry_count, created_at FROM sync_queue WHERE status = 'processing' ORDER BY created_at DESC LIMIT 10`);
        console.log('\nSon 10 processing kayıt:');
        console.table(processing);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
