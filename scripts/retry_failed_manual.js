require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkFailed() {
    try {
        const failed = await pgService.query(`
            SELECT count(*) as cnt FROM sync_queue 
            WHERE status = 'failed' AND entity_type = 'entegra_product_manual'
        `);
        console.log(`Failed entegra_product_manual sayisi: ${failed[0].cnt}`);

        if (failed[0].cnt > 0) {
            console.log('Retry calistiriliyor...');
            await pgService.query(`
                UPDATE sync_queue 
                SET status = 'pending', retry_count = 0, error_message = NULL
                WHERE status = 'failed' AND entity_type = 'entegra_product_manual'
            `);
            console.log('Kayitlar pending duruma alindi.');
        }
    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}
checkFailed();
