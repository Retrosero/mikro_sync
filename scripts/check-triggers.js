require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkTriggers() {
    try {
        const triggers = await pgService.query(`
      SELECT event_object_table, trigger_name, event_manipulation 
      FROM information_schema.triggers 
      WHERE event_object_table IN ('stoklar', 'cari_hesaplar')
      ORDER BY event_object_table, trigger_name;
    `);
        console.log('Triggers:', JSON.stringify(triggers, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pgService.disconnect();
    }
}

checkTriggers();
