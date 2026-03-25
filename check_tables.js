const pgService = require('./services/postgresql.service');

async function main() {
    try {
        // sync ile baslayan tablolar
        const tables = await pgService.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name LIKE '%sync%'
            ORDER BY table_name
        `);
        console.log('Sync tablolari:');
        tables.forEach(t => console.log('  -', t.table_name));

        // queue ile baslayan tablolar
        const queueTables = await pgService.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name LIKE '%queue%'
            ORDER BY table_name
        `);
        console.log('\nQueue tablolari:');
        queueTables.forEach(t => console.log('  -', t.table_name));

        // sync_queue tablosu varsa kayit sayisi
        const syncQueueCount = await pgService.query(`SELECT COUNT(*) as count FROM sync_queue`);
        console.log('\nsync_queue kayit sayisi:', syncQueueCount[0].count);

        // Son 10 kayit
        const lastRecords = await pgService.query(`SELECT id, entity_type, entity_id, status, created_at FROM sync_queue ORDER BY id DESC LIMIT 10`);
        console.log('\nSon 10 sync_queue kaydi:');
        console.table(lastRecords);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
