require('dotenv').config();
const sqliteService = require('../services/sqlite.service');

function checkProductDescriptionTable() {
    try {
        sqliteService.connect(true);

        console.log('=== product_description TABLO YAPISI ===');
        const schema = sqliteService.getTableSchema('product_description');
        schema.forEach(col => {
            console.log(`  ${col.name}: ${col.type} ${col.pk ? '(PK)' : ''}`);
        });

        // Örnek veri
        console.log('\n=== ORNEK VERI (product_id=19822) ===');
        const sample = sqliteService.query(`
            SELECT * FROM product_description WHERE product_id = 19822
        `);

        if (sample.length > 0) {
            console.log(JSON.stringify(sample[0], null, 2));
        } else {
            console.log('Kayit bulunamadi');

            // Genel örnek
            console.log('\n=== GENEL ORNEK (ilk kayit) ===');
            const general = sqliteService.query(`SELECT * FROM product_description LIMIT 1`);
            if (general.length > 0) {
                console.log(JSON.stringify(general[0], null, 2));
            }
        }

        sqliteService.disconnect();

    } catch (error) {
        console.error('Hata:', error);
    }
}

checkProductDescriptionTable();
