require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function checkQueue() {
    try {
        // Tüm bekleyen kayıtları al
        const pendingItems = await pgService.query(`
            SELECT id, entity_type, entity_id, operation, retry_count, error_message, created_at
            FROM sync_queue
            WHERE status = 'pending'
            ORDER BY created_at ASC
        `);

        const output = [];
        output.push('Bekleyen kayitlar:');
        output.push(JSON.stringify(pendingItems, null, 2));

        // Tüm entity tiplerini grupla
        const entityTypes = await pgService.query(`
            SELECT entity_type, COUNT(*) as cnt, status
            FROM sync_queue
            GROUP BY entity_type, status
            ORDER BY entity_type, status
        `);

        output.push('\nEntity tipleri ve durumları:');
        output.push(JSON.stringify(entityTypes, null, 2));

        fs.writeFileSync('queue_status.txt', output.join('\n'), 'utf8');
        console.log('Sonuclar queue_status.txt dosyasina yazildi');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkQueue();
