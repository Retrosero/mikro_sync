require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkQueueStatus() {
    try {
        console.log('=== QUEUE DURUMU ===\n');

        // entegra_product durumu
        const productStatus = await pgService.query(`
            SELECT status, count(*) as cnt 
            FROM sync_queue 
            WHERE entity_type = 'entegra_product'
            GROUP BY status
        `);

        console.log('entegra_product:');
        productStatus.forEach(s => {
            console.log(`  ${s.status}: ${s.cnt}`);
        });

        // Genel durum
        console.log('\nGenel:');
        const generalStatus = await pgService.query(`
            SELECT status, count(*) as cnt 
            FROM sync_queue 
            GROUP BY status
        `);
        generalStatus.forEach(s => {
            console.log(`  ${s.status}: ${s.cnt}`);
        });

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkQueueStatus();
