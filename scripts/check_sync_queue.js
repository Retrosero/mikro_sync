const pgService = require('../services/postgresql.service');

async function checkSyncQueue() {
    try {
        const result = await pgService.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sync_queue'
    `);

        console.log('sync_queue Columns:');
        result.forEach(row => {
            console.log(row.column_name);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkSyncQueue();
