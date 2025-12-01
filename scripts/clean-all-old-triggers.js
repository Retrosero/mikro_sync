require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function cleanAllOldTriggers() {
    try {
        console.log('Tüm Eski Trigger Sistemini Temizleme...');
        console.log('='.repeat(70));

        // 1. Tüm trigger'ları listele
        const triggers = await pgService.query(`
      SELECT 
        tgname as trigger_name,
        tgrelid::regclass as table_name
      FROM pg_trigger
      WHERE tgname LIKE '%sync%'
    `);

        console.log(`${triggers.length} sync trigger bulundu:\n`);
        triggers.forEach(t => {
            console.log(`  - ${t.trigger_name} on ${t.table_name}`);
        });

        // 2. Tüm trigger'ları sil
        for (const t of triggers) {
            await pgService.query(`DROP TRIGGER IF EXISTS ${t.trigger_name} ON ${t.table_name} CASCADE`);
            console.log(`✓ Silindi: ${t.trigger_name}`);
        }

        // 3. Tüm sync fonksiyonlarını sil
        const functions = await pgService.query(`
      SELECT proname as function_name
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND proname LIKE '%sync%'
        AND proname NOT IN ('notify_satis_sync', 'notify_tahsilat_sync')
    `);

        console.log(`\n${functions.length} sync fonksiyon bulundu:\n`);
        for (const f of functions) {
            await pgService.query(`DROP FUNCTION IF EXISTS ${f.function_name}() CASCADE`);
            console.log(`✓ Silindi: ${f.function_name}()`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('✓ Tüm eski trigger sistem temizlendi!');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('✗ Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

cleanAllOldTriggers();
