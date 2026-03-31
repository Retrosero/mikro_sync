const pgService = require('./services/postgresql.service');

async function checkQueue() {
    try {
        console.log('--- Duplicate Pending Items in sync_queue ---');
        const dups = await pgService.query(`
            SELECT entity_type, entity_id, COUNT(*) 
            FROM sync_queue 
            WHERE status = 'pending' 
            GROUP BY entity_type, entity_id 
            HAVING COUNT(*) > 1
        `);
        console.log(JSON.stringify(dups, null, 2));

        console.log('\n--- Recent sync_queue for a4ad2325-0eb0-461f-b760-25d0dc1bfece ---');
        const specific = await pgService.query(`
            SELECT id, status, created_at, processed_at, error_message, operation
            FROM sync_queue
            WHERE entity_id = 'a4ad2325-0eb0-461f-b760-25d0dc1bfece'
            ORDER BY created_at DESC
        `);
        console.log(JSON.stringify(specific, null, 2));

        console.log('\n--- Mapping for a4ad2325-0eb0-461f-b760-25d0dc1bfece ---');
        const mapping = await pgService.query(`
            SELECT * FROM int_satis_mapping WHERE web_satis_id = 'a4ad2325-0eb0-461f-b760-25d0dc1bfece'
        `);
        console.log(JSON.stringify(mapping, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkQueue();
