require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkQueue() {
    try {
        const res = await pgService.query(`
            SELECT * 
            FROM sync_queue 
            WHERE record_data->'changes'->>'productCode' = '6056902'
            OR record_data->>'product_code' = '6056902'
            OR record_data->>'Product_code' = '6056902'
        `);
        console.log('Queue Items:', JSON.stringify(res, null, 2));

        // Let's also search by content
        const res2 = await pgService.query(`
            SELECT * 
            FROM sync_queue 
            WHERE record_data::text LIKE '%6056902%'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        console.log('Queue Items (Text Search):', JSON.stringify(res2, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkQueue();
