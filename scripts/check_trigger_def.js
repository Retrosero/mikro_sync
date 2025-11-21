const pgService = require('../services/postgresql.service');

async function checkTriggerDef() {
    try {
        const result = await pgService.query(`
      SELECT pg_get_triggerdef(oid) as def
      FROM pg_trigger
      WHERE tgname = 'stok_durumu_trigger'
    `);

        if (result.length > 0) {
            console.log('Trigger Definition:');
            console.log(result[0].def);
        } else {
            console.log('Trigger not found');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkTriggerDef();
