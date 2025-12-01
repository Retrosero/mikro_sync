require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkSyncQueueColumns() {
    try {
        console.log("Checking columns for 'sync_queue'...");
        const columns = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sync_queue'
        `);
        console.log(columns);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pgService.disconnect();
    }
}

checkSyncQueueColumns();
