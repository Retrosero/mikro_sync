require('dotenv').config();
const sqliteService = require('../services/sqlite.service');

function verifyDescriptionUpdate() {
    try {
        console.log('=== SQLite DOGRULAMA ===\n');

        sqliteService.connect(true);

        // Product tablosu
        const product = sqliteService.queryOne(`
            SELECT id, productCode, sub_name FROM product WHERE id = 19822
        `);

        // Product description tablosu
        const description = sqliteService.queryOne(`
            SELECT product_id, description FROM product_description WHERE product_id = 19822
        `);

        console.log('product ID=19822:');
        console.log(`  Code: ${product.productCode}`);
        console.log(`  sub_name: ${product.sub_name}`);

        console.log('\nproduct_description (product_id=19822):');
        console.log(`  description: ${description.description}`);

        // Beklenen değerler
        if (product.sub_name === 'TEST URUN ADI' &&
            description.description === 'TEST ACIKLAMA METNI') {
            console.log('\n✓ TEST BASARILI! Her iki alan da dogru tablolara yazildi.');
            console.log('  - sub_name -> product tablosuna ✓');
            console.log('  - description -> product_description tablosuna ✓');
        } else {
            console.log('\n❌ Guncellemede sorun var.');
        }

        sqliteService.disconnect();

    } catch (error) {
        console.error('Hata:', error);
    }
}

verifyDescriptionUpdate();
