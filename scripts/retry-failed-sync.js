require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function retryFailedSync() {
    try {
        console.log('Başarısız Sync Kayıtları Tekrar Deneniyor...');
        console.log('='.repeat(70));

        // Failed kayıtları pending'e geri al
        const result = await pgService.query(`
      UPDATE sync_queue 
      SET status = 'pending', retry_count = 0, error_message = NULL
      WHERE status = 'failed'
      RETURNING id, entity_type
    `);

        console.log(`✓ ${result.length} kayıt pending'e alındı`);
        result.forEach(r => {
            console.log(`  - ${r.entity_type} (${r.id})`);
        });

        console.log('\nWorker bu kayıtları otomatik olarak işleyecek...');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('✗ Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

retryFailedSync();
