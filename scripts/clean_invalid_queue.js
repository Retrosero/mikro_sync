require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function cleanInvalidQueueItems() {
    try {
        // entegra_product_manual entity_type'li kayıtları sil veya failed yap
        const result = await pgService.query(`
            DELETE FROM sync_queue 
            WHERE entity_type = 'entegra_product_manual'
            RETURNING id, entity_type, entity_id
        `);

        console.log('Silinen kayıtlar:');
        console.log(JSON.stringify(result, null, 2));

        console.log(`\n${result.length} adet geçersiz kayıt silindi.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

cleanInvalidQueueItems();
