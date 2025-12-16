require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        const res = await pgService.query('SELECT * FROM cari_hesaplar LIMIT 1');
        if (res.length > 0) {
            console.log('Sütunlar:', Object.keys(res[0]));
        } else {
            console.log('Tablo boş.');
        }
        await pgService.disconnect();
    } catch (error) {
        console.error(error);
    }
})();
