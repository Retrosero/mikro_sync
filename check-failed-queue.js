require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('Bağlanıyor...');
        // Veritabanına sorgu at
        const failedItems = await pgService.query(`
            SELECT id, entity_type, entity_id, status, retry_count, error_message, created_at, processed_at
            FROM sync_queue
            WHERE status = 'failed'
            ORDER BY processed_at DESC
        `);

        console.log(`Toplam ${failedItems.length} hatalı kayıt bulundu.\n`);

        failedItems.forEach((item, index) => {
            console.log(`${index + 1}. ID: ${item.id}`);
            console.log(`   Tip: ${item.entity_type}`);
            console.log(`   Entity ID: ${item.entity_id}`);
            console.log(`   Hata: ${item.error_message}`);
            console.log(`   Deneme: ${item.retry_count}`);
            console.log(`   Son İşlem: ${item.processed_at}`);
            console.log('-'.repeat(50));
        });

        const pendingItems = await pgService.query(`
            SELECT count(*) as count FROM sync_queue WHERE status = 'pending'
        `);
        console.log(`\nBekleyen Kayıt Sayısı: ${pendingItems[0].count}`);

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        await pgService.disconnect();
    }
})();
