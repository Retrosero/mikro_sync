
require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('--- ALISLAR FATURA TIPLERI ---');
        const alisTipleri = await pgService.query("SELECT fatura_tipi, iade, count(*) FROM alislar GROUP BY fatura_tipi, iade");
        console.table(alisTipleri);

        console.log('\n--- SATISLAR FATURA TIPLERI ---');
        const satisTipleri = await pgService.query("SELECT fatura_tipi, iade, count(*) FROM satislar GROUP BY fatura_tipi, iade");
        console.table(satisTipleri);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
})();
