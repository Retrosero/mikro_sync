require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function check() {
    try {
        const result = await pgService.query('SELECT count(*) as count FROM entegra_order');
        console.log('Total count:', result[0].count);

        const recent = await pgService.query('SELECT id, date_add FROM entegra_order ORDER BY id DESC LIMIT 5');
        console.log('Recent 5 by ID:');
        console.log(JSON.stringify(recent, null, 2));
    } catch (e) { console.error(e); }
    finally { await pgService.disconnect(); }
}

check();
