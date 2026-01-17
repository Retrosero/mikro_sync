require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function retryProcessing() {
    try {
        console.log('Processing kayıtlar pending\'e alınıyor...');
        const result = await pgService.query(`
            UPDATE sync_queue 
            SET status = 'pending', retry_count = 0 
            WHERE entity_type = 'entegra_product_manual' AND status = 'processing'
            RETURNING id
        `);
        console.log(`${result.length} kayıt güncellendi.`);
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

retryProcessing();
