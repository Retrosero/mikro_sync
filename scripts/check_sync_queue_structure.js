require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function checkSyncQueueStructure() {
    try {
        let output = '=== SYNC_QUEUE TABLO YAPISI ===\n\n';

        const columns = await pgService.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'sync_queue'
            ORDER BY ordinal_position
        `);

        columns.forEach(c => {
            output += `${c.column_name}: ${c.data_type} (${c.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'}) ${c.column_default ? 'DEFAULT ' + c.column_default : ''}\n`;
        });

        fs.writeFileSync('sync_queue_structure.txt', output, 'utf8');
        console.log('Sonuclar sync_queue_structure.txt dosyasina yazildi.');
        console.log('Kolon sayisi:', columns.length);

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkSyncQueueStructure();
