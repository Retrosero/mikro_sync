
require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('--- ALISLAR SCHEMA ---');
        const res = await pgService.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'alislar'");
        console.log(res.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
})();
