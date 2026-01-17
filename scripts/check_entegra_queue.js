require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkQueue() {
    try {
        const pendingItems = await pgService.query(`
            SELECT id, entity_type, entity_id, operation, retry_count, error_message, created_at
            FROM sync_queue
            WHERE status = 'pending'
            ORDER BY created_at ASC
        `);

        console.log('Bekleyen kayıtlar:');
        console.log(JSON.stringify(pendingItems, null, 2));

        // entegra_product_manual kayıtlarını bul
        const manualItems = await pgService.query(`
            SELECT * FROM sync_queue
            WHERE entity_type = 'entegra_product_manual'
        `);

        console.log('\nentegra_product_manual kayıtları:');
        console.log(JSON.stringify(manualItems, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkQueue();
