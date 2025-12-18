
require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('--- SATIS TİPLERİ ---');
        const res = await pgService.query("SELECT satis_tipi, count(*) FROM satislar GROUP BY satis_tipi");
        console.table(res);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
})();
