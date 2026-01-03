require('dotenv').config();
const fs = require('fs');
const pg = require('./services/postgresql.service');

async function checkQueue() {
    const results = [];
    try {
        const pending = await pg.query(`
      SELECT id, entity_type, entity_id, status, error_message, retry_count 
      FROM sync_queue 
      WHERE entity_type = 'stoklar'
      ORDER BY created_at DESC
      LIMIT 10
    `);
        results.push('Son 10 stok queue kaydi:');
        pending.forEach(r => {
            results.push('Status: ' + r.status + ' | Entity: ' + r.entity_id + ' | Retry: ' + r.retry_count);
            if (r.error_message) results.push('  Error: ' + r.error_message);
        });

        fs.writeFileSync('queue-check-result.txt', results.join('\n'), 'utf8');
        console.log('Sonuclar queue-check-result.txt dosyasina yazildi');
    } catch (e) { console.error(e); }
    finally { await pg.disconnect(); }
}
checkQueue();
