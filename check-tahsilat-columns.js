require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        const res = await pgService.query('SELECT * FROM tahsilatlar LIMIT 1');
        if (res.length > 0) {
            console.log('Sütunlar:', Object.keys(res[0]));
        } else {
            console.log('Tablo boş, ama sütun adlarını almak için bilgi schema sorgulanabilir.');
            // Alternatif olarak information_schema'dan bakabilirim ama Node pg kütüphanesi sonuç boşsa key vermez.
            // Boşsa şunu deneyelim:
            const schema = await pgService.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tahsilatlar'");
            console.log('Schema Sütunlar:', schema.map(r => r.column_name));
        }
        await pgService.disconnect();
    } catch (error) {
        console.error(error);
    }
})();
