require('dotenv').config();
const pgService = require('./services/postgresql.service');
const fs = require('fs');

(async () => {
    try {
        console.log('ODEME_EMIRLERI tablosu oluşturuluyor...');

        const sql = fs.readFileSync('create-odeme-emirleri-table.sql', 'utf8');

        await pgService.query(sql);

        console.log('✓ ODEME_EMIRLERI tablosu başarıyla oluşturuldu!');

        await pgService.disconnect();
    } catch (err) {
        console.error('Hata:', err);
        process.exit(1);
    }
})();
