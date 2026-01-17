require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkStatus() {
    try {
        const counts = await pgService.query(`
            SELECT status, count(*) as cnt 
            FROM sync_queue 
            WHERE entity_type = 'entegra_product_manual'
            GROUP BY status
        `);
        console.log('Durum Dagilimi:');
        counts.forEach(c => {
            console.log(`  ${c.status}: ${c.cnt}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}
checkStatus();
