const pgService = require('../services/postgresql.service');

async function checkTriggers() {
    try {
        const result = await pgService.query(`
      SELECT event_object_table, trigger_name, action_statement
      FROM information_schema.triggers
      WHERE event_object_table IN ('sync_state', 'stoklar', 'urun_barkodlari', 'cari_hesaplar')
    `);

        console.log('Triggers:');
        result.forEach(row => {
            console.log(`Table: ${row.event_object_table}, Trigger: ${row.trigger_name}`);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkTriggers();
