require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkSyncLogs() {
    try {
        console.log("Checking sync_logs for recent entries...");
        const logs = await pgService.query(`
            SELECT * FROM sync_logs 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        logs.forEach(log => {
            console.log('--------------------------------------------------');
            console.log(`Time: ${log.created_at}`);
            console.log(`Table: ${log.table_name}`);
            console.log(`Operation: ${log.operation}`);
            console.log(`Status: ${log.sync_status}`);
            console.log(`Error: ${log.error_message}`);
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pgService.disconnect();
    }
}

checkSyncLogs();
