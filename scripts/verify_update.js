require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

function verifyUpdate() {
    let output = '';
    function log(msg) {
        output += msg + '\n';
    }

    try {
        log('=== SQLite DOGRULAMA ===');

        sqliteService.connect(true);

        // ID=4 olan kaydı kontrol et
        const record = sqliteService.queryOne(
            `SELECT * FROM product_quantity WHERE id = 4`
        );

        log('product_quantity ID=4:');
        log(JSON.stringify(record, null, 2));

        if (record) {
            log('');
            log('Miktar: ' + record.quantity);
            if (record.quantity === 30) {
                log('TEST BASARILI! Miktar 29\'dan 30\'a guncellendi.');
            } else if (record.quantity === 29) {
                log('Miktar hala 29 - guncelleme uygulanmamis olabilir.');
            }
        }

        sqliteService.disconnect();

        fs.writeFileSync('verify_result.txt', output, 'utf8');
        console.log('Sonuc verify_result.txt dosyasina yazildi.');

    } catch (error) {
        console.error('Hata:', error);
    }
}

verifyUpdate();
