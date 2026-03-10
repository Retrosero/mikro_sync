const mssqlService = require('./services/mssql.service');

async function checkTriggers() {
    try {
        const triggers = await mssqlService.query(`
            SELECT 
                t.name AS TriggerName,
                OBJECT_NAME(t.parent_id) AS TableName,
                t.is_disabled
            FROM sys.triggers t
            WHERE OBJECT_NAME(t.parent_id) IN ('STOKLAR', 'BARKOD_TANIMLARI', 'STOK_SATIS_FIYAT_LISTELERI')
        `);
        console.log('--- ERP Triggers ---');
        triggers.forEach(trig => console.log(JSON.stringify(trig)));

        const queueCount = await mssqlService.query("SELECT COUNT(*) as count FROM SYNC_QUEUE WHERE status = 'pending'");
        console.log(`Pending items in MS SQL SYNC_QUEUE: ${queueCount[0].count}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkTriggers();
