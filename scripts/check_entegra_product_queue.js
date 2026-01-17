require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkEntegraProductQueue() {
    try {
        console.log('=== entegra_product QUEUE DURUMU ===\n');

        const counts = await pgService.query(`
            SELECT status, count(*) as cnt 
            FROM sync_queue 
            WHERE entity_type = 'entegra_product'
            GROUP BY status
        `);

        console.log('Durum Dagilimi:');
        counts.forEach(c => {
            console.log(`  ${c.status}: ${c.cnt}`);
        });

        // Pending kayıtlar
        const pending = await pgService.query(`
            SELECT id, entity_id, record_data->>'product_id' as product_id, created_at
            FROM sync_queue 
            WHERE entity_type = 'entegra_product' AND status = 'pending'
            ORDER BY created_at ASC
            LIMIT 5
        `);

        if (pending.length > 0) {
            console.log('\nPending kayitlar (ilk 5):');
            pending.forEach(p => {
                console.log(`  ID: ${p.id}, ProductID: ${p.product_id}`);
            });
        }

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkEntegraProductQueue();
