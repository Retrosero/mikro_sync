require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function testEntegraProductManual() {
    try {
        console.log('=== entegra_product_manual SYNC TEST ===\n');

        // 1. Test için sync_queue'ya bir entegra_product_manual kaydı ekle
        console.log('1. Test kaydı ekleniyor...');
        const insertResult = await pgService.query(`
            INSERT INTO sync_queue (entity_type, entity_id, operation, status, created_at)
            VALUES ('entegra_product_manual', 'test-record-123', 'UPDATE', 'pending', NOW())
            RETURNING id
        `);
        console.log('   Test kaydı eklendi:', insertResult[0].id);

        // 2. Mevcut durumu göster
        console.log('\n2. Mevcut sync_queue pending kayıtları:');
        const pending = await pgService.query(`
            SELECT entity_type, status, COUNT(*) as cnt
            FROM sync_queue
            WHERE status = 'pending'
            GROUP BY entity_type, status
        `);
        pending.forEach(p => console.log(`   ${p.entity_type}: ${p.cnt}`));

        console.log('\n=== TEST TAMAMLANDI ===');
        console.log('Şimdi sync-queue-worker çalıştırıldığında bu kayıt otomatik olarak "completed" olarak işaretlenecek.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

testEntegraProductManual();
