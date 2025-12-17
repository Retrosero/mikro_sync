require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('Tablo güncelleniyor: satislar');

        for (let i = 1; i <= 6; i++) {
            const colName = `iskonto${i}`;
            console.log(`Eklenecek kolon: ${colName}`);
            await pgService.query(`
                ALTER TABLE satislar 
                ADD COLUMN IF NOT EXISTS ${colName} NUMERIC(10,2) DEFAULT 0;
            `);
        }

        console.log('Kolonlar başarıyla eklendi.');

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        await pgService.disconnect();
    }
})();
