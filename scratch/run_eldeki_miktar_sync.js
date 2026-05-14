require('dotenv').config();
const eldekiMiktarProcessor = require('../sync-jobs/eldeki-miktar.processor');
const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');

async function runEldekiMiktarSync() {
    try {
        console.log('Running Eldeki Miktar Sync...');
        const count = await eldekiMiktarProcessor.syncToWeb(null, 1000);
        console.log(`Successfully synced ${count} records.`);
    } catch (error) {
        console.error('Sync failed:', error);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

runEldekiMiktarSync();
