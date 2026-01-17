require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkTriggers() {
    try {
        // entegra_product_manual tablosundaki trigger'ları kontrol et
        const triggers = await pgService.query(`
            SELECT 
                trigger_name, 
                event_manipulation, 
                action_timing,
                action_statement
            FROM information_schema.triggers 
            WHERE event_object_table = 'entegra_product_manual'
        `);

        console.log('=== entegra_product_manual TRIGGER\'LARI ===\n');
        if (triggers.length > 0) {
            triggers.forEach((t, i) => {
                console.log(`Trigger ${i + 1}: ${t.trigger_name}`);
                console.log(`  Event: ${t.event_manipulation}`);
                console.log(`  Timing: ${t.action_timing}`);
                console.log(`  Statement: ${t.action_statement}`);
                console.log('');
            });
        } else {
            console.log('Bu tabloda trigger bulunamadı.');
        }

        // Trigger fonksiyonlarını kontrol et
        const triggerFuncs = await pgService.query(`
            SELECT 
                proname as func_name,
                prosrc as func_source
            FROM pg_proc 
            WHERE proname LIKE '%sync_queue%' OR proname LIKE '%entegra%'
        `);

        console.log('\n=== SYNC QUEUE FONKSİYONLARI ===\n');
        if (triggerFuncs.length > 0) {
            triggerFuncs.forEach((f, i) => {
                console.log(`Fonksiyon ${i + 1}: ${f.func_name}`);
                console.log('---');
                console.log(f.func_source);
                console.log('\n');
            });
        } else {
            console.log('Bu isimde fonksiyon bulunamadı.');
        }

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkTriggers();
