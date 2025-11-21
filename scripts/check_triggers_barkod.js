const pgService = require('../services/postgresql.service');

async function checkTriggers() {
    try {
        const result = await pgService.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'urun_barkodlari'
    `);

        console.log('Triggers:');
        result.forEach(row => {
            console.log(row.trigger_name);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkTriggers();
