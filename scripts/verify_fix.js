const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

async function verify() {
    try {
        // PG Verification
        const pgLogs = await pgService.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sync_logs' AND column_name = 'direction'
    `);
        console.log('PostgreSQL sync_logs.direction:', pgLogs.length > 0 ? 'MEVCUT' : 'EKSİK');

        const pgQueueNull = await pgService.query('SELECT count(*) as count FROM sync_queue WHERE source_table IS NULL');
        console.log('PostgreSQL sync_queue null source_table count:', pgQueueNull[0].count);

        // MSSQL Verification
        const mssqlQueue = await mssqlService.query(`
      SELECT count(*) as count FROM sys.tables WHERE name = 'SYNC_QUEUE'
    `);
        console.log('MS SQL SYNC_QUEUE:', mssqlQueue[0].count > 0 ? 'MEVCUT' : 'EKSİK');

        const mssqlLogs = await mssqlService.query(`
      SELECT count(*) as count FROM sys.tables WHERE name = 'SYNC_LOGS'
    `);
        console.log('MS SQL SYNC_LOGS:', mssqlLogs[0].count > 0 ? 'MEVCUT' : 'EKSİK');

    } catch (error) {
        console.error('Doğrulama hatası:', error.message);
    }
    process.exit(0);
}

verify();
