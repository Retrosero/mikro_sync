require('dotenv').config();
const pg = require('./services/postgresql.service');

async function resetQueue() {
    try {
        // Bekleyen stoklar kayitlarini pending yap
        const result = await pg.query(`
      UPDATE sync_queue 
      SET status = 'pending', retry_count = 0, error_message = NULL 
      WHERE entity_type = 'stoklar' AND status IN ('pending', 'failed')
      RETURNING id, entity_type, entity_id
    `);
        console.log('Sifirlanan kayit sayisi:', result.length);
        if (result.length > 0) {
            result.forEach(r => console.log('- ID:', r.id, 'Entity:', r.entity_id));
        }
    } catch (e) { console.error(e); }
    finally { await pg.disconnect(); }
}
resetQueue();
