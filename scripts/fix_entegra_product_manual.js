require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function fixEntegraProductManual() {
    try {
        console.log('=== entegra_product_manual SYNC QUEUE DÜZELTME ===\n');

        // 1. Mevcut pending kayıtları sil
        console.log('1. Mevcut entegra_product_manual pending kayıtları siliniyor...');
        const deleted = await pgService.query(`
            DELETE FROM sync_queue 
            WHERE entity_type = 'entegra_product_manual'
            AND status IN ('pending', 'processing', 'failed')
            RETURNING id, entity_id, status
        `);
        console.log(`   ${deleted.length} kayıt silindi.`);

        // 2. entegra_product_manual tablosundaki sync_queue trigger'ını kaldır
        console.log('\n2. entegra_product_manual tablosundaki sync trigger kontrol ediliyor...');

        const triggers = await pgService.query(`
            SELECT tgname
            FROM pg_trigger 
            JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
            WHERE relname = 'entegra_product_manual'
            AND NOT tgisinternal
            AND tgname LIKE '%sync%'
        `);

        if (triggers.length > 0) {
            for (const trigger of triggers) {
                console.log(`   Trigger kaldırılıyor: ${trigger.tgname}`);
                await pgService.query(`DROP TRIGGER IF EXISTS ${trigger.tgname} ON entegra_product_manual`);
                console.log(`   Trigger kaldırıldı: ${trigger.tgname}`);
            }
        } else {
            console.log('   Sync trigger bulunamadı, muhtemelen genel bir trigger kullanılıyor.');

            // Tüm trigger'ları kontrol et
            const allTriggers = await pgService.query(`
                SELECT tgname
                FROM pg_trigger 
                JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
                WHERE relname = 'entegra_product_manual'
                AND NOT tgisinternal
            `);

            console.log(`   Mevcut trigger sayısı: ${allTriggers.length}`);
            allTriggers.forEach(t => console.log(`   - ${t.tgname}`));
        }

        // 3. Sync queue durumunu tekrar kontrol et
        console.log('\n3. Güncel sync_queue durumu:');
        const currentStatus = await pgService.query(`
            SELECT entity_type, status, COUNT(*) as cnt
            FROM sync_queue
            WHERE status IN ('pending', 'processing')
            GROUP BY entity_type, status
            ORDER BY entity_type
        `);

        if (currentStatus.length === 0) {
            console.log('   Bekleyen/işlenen kayıt yok. ✓');
        } else {
            currentStatus.forEach(s => {
                console.log(`   ${s.entity_type}: ${s.cnt} ${s.status}`);
            });
        }

        console.log('\n=== İŞLEM TAMAMLANDI ===');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

fixEntegraProductManual();
