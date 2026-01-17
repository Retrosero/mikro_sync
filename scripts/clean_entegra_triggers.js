require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function cleanEntegraProductManualTriggers() {
    try {
        console.log('=== entegra_product_manual TRIGGER TEMIZLIGI ===\n');

        // 1. entegra_product_manual tablosundaki tüm trigger'ları listele
        const triggers = await pgService.query(`
            SELECT t.tgname as trigger_name, p.proname as function_name
            FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            JOIN pg_proc p ON t.tgfoid = p.oid
            WHERE c.relname = 'entegra_product_manual'
            AND NOT t.tgisinternal
        `);

        console.log('Mevcut trigger sayisi:', triggers.length);

        if (triggers.length > 0) {
            console.log('Bulunan trigger\'lar:');
            triggers.forEach(t => console.log(`  - ${t.trigger_name} (Fonksiyon: ${t.function_name})`));

            // Her trigger'ı kaldır
            for (const trigger of triggers) {
                console.log(`\nKaldiriliyor: ${trigger.trigger_name}`);
                await pgService.query(`DROP TRIGGER IF EXISTS "${trigger.trigger_name}" ON entegra_product_manual`);
                console.log(`  Kaldirildi!`);
            }
        } else {
            console.log('entegra_product_manual tablosunda sync trigger bulunamadi.');
            console.log('Kayit muhtemelen baska bir yolla eklenmis veya trigger zaten kaldirilmis.');
        }

        // 2. Mevcut pending entegra_product_manual kayitlarini temizle
        console.log('\n--- Pending kayitlar temizleniyor ---');
        const deleted = await pgService.query(`
            DELETE FROM sync_queue 
            WHERE entity_type = 'entegra_product_manual'
            AND status IN ('pending', 'processing', 'failed')
            RETURNING id
        `);
        console.log(`${deleted.length} adet pending/failed kayit silindi.`);

        console.log('\n=== ISLEM TAMAMLANDI ===');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

cleanEntegraProductManualTriggers();
