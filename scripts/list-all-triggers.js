require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function listAllTriggers() {
    try {
        console.log('Tüm Trigger ve Fonksiyonlar Listeleniyor...');
        console.log('='.repeat(70));

        // Trigger'ları listele
        const triggers = await pgService.query(`
      SELECT 
        trigger_name,
        event_object_table,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);

        console.log('\nMevcut Trigger\'lar:');
        triggers.forEach(t => {
            console.log(`\n  ${t.trigger_name} -> ${t.event_object_table}`);
            console.log(`    ${t.action_statement.substring(0, 100)}...`);
        });

        // Fonksiyonları listele
        const functions = await pgService.query(`
      SELECT 
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        AND routine_name LIKE '%sync%' OR routine_name LIKE '%sale%' OR routine_name LIKE '%trigger%'
      ORDER BY routine_name
    `);

        console.log('\n\nİlgili Fonksiyonlar:');
        functions.forEach(f => {
            console.log(`  - ${f.routine_name} (${f.routine_type})`);
        });

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('✗ Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

listAllTriggers();
