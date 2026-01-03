/**
 * Başarısız barkod kayıtlarını tekrar pending yapan script
 */
require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function resetFailedBarkodRecords() {
    try {
        console.log('Başarısız barkod kayıtları pending yapılıyor...\n');

        const result = await pgService.query(`
            UPDATE sync_queue 
            SET status = 'pending', 
                retry_count = 0, 
                error_message = NULL
            WHERE status = 'failed' 
            AND entity_type = 'urun_barkodlari'
            RETURNING id, entity_id
        `);

        if (result.length === 0) {
            console.log('Başarısız barkod kaydı bulunamadı.');
        } else {
            console.log(`${result.length} kayıt pending yapıldı:`);
            result.forEach((r, idx) => {
                console.log(`  ${idx + 1}. ID: ${r.id}, Entity ID: ${r.entity_id}`);
            });
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

resetFailedBarkodRecords();
