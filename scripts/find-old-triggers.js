require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function findOldTriggers() {
    try {
        console.log('Eski Trigger Fonksiyonları Aranıyor...');
        console.log('='.repeat(70));

        // Tüm trigger fonksiyonlarını bul
        const functions = await pgService.query(`
      SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname LIKE '%sync%'
        AND pg_get_functiondef(p.oid) LIKE '%table_name%'
    `);

        console.log(`${functions.length} fonksiyon bulundu\n`);

        functions.forEach(f => {
            console.log(`Fonksiyon: ${f.function_name}`);
            console.log(f.function_definition);
            console.log('\n' + '-'.repeat(70) + '\n');
        });

        console.log('='.repeat(70));

    } catch (error) {
        console.error('✗ Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

findOldTriggers();
