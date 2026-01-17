require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkQueueStatus() {
    try {
        // Entity tipine ve statüye göre grupla
        const stats = await pgService.query(`
            SELECT entity_type, status, COUNT(*) as count 
            FROM sync_queue 
            GROUP BY entity_type, status 
            ORDER BY entity_type, status
        `);

        console.log('=== SYNC QUEUE DURUMU ===\n');
        console.log('Entity Tipi ve Statüye Göre Dağılım:');
        console.log(JSON.stringify(stats, null, 2));

        // entegra_product_manual kayıtlarını detaylı göster
        const manualItems = await pgService.query(`
            SELECT id, entity_type, entity_id, status, retry_count, error_message, created_at 
            FROM sync_queue 
            WHERE entity_type = 'entegra_product_manual'
            ORDER BY created_at DESC
            LIMIT 10
        `);

        console.log('\n=== entegra_product_manual KAYITLARI ===');
        console.log(`Toplam kayıt (gösterilen max 10):`, manualItems.length);
        if (manualItems.length > 0) {
            console.log(JSON.stringify(manualItems, null, 2));
        } else {
            console.log('Bu entity tipinde kayıt bulunamadı.');
        }

        // Toplam entegra_product_manual sayısı
        const countResult = await pgService.query(`
            SELECT COUNT(*) as toplam FROM sync_queue WHERE entity_type = 'entegra_product_manual'
        `);
        console.log('\nToplam entegra_product_manual sayısı:', countResult[0].toplam);

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkQueueStatus();
