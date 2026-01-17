require('dotenv').config();
const sqliteService = require('../services/sqlite.service');

function verifyUpdate() {
    try {
        console.log('=== SQLite DOGRULAMA ===\n');

        sqliteService.connect(true);

        const record = sqliteService.queryOne(`
            SELECT id, productCode, productName, gtin, sub_name2, country_of_origin 
            FROM product 
            WHERE id = 19822
        `);

        console.log('product ID=19822:');
        console.log(`  ID: ${record.id}`);
        console.log(`  Code: ${record.productCode}`);
        console.log(`  Name: ${record.productName}`);
        console.log(`  GTIN: ${record.gtin || 'bos'}`);
        console.log(`  sub_name2: ${record.sub_name2 || 'bos'}`);
        console.log(`  country_of_origin: ${record.country_of_origin || 'bos'}`);

        if (record.gtin === 'TEST123456789' &&
            record.sub_name2 === 'TEST ALT ISIM' &&
            record.country_of_origin === 'TEST ULKE') {
            console.log('\n✓ TEST BASARILI! Tum alanlar dogru guncellendi.');
        } else {
            console.log('\n❌ Bazi alanlar guncellenemedi.');
        }

        sqliteService.disconnect();

    } catch (error) {
        console.error('Hata:', error);
    }
}

verifyUpdate();
