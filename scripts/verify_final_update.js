require('dotenv').config();
const sqliteService = require('../services/sqlite.service');

function verifyFinalUpdate() {
    try {
        console.log('=== SQLite DOGRULAMA ===\n');

        sqliteService.connect(true);

        // Product tablosu
        const product = sqliteService.queryOne(`
            SELECT id, productCode, productName, sub_name, sub_name2, description, country_of_origin 
            FROM product 
            WHERE id = 19822
        `);

        console.log('product ID=19822:');
        console.log(`  Code: ${product.productCode}`);
        console.log(`  Name: ${product.productName}`);
        console.log(`  sub_name: ${product.sub_name || 'bos'}`);
        console.log(`  sub_name2: ${product.sub_name2 || 'bos'}`);
        console.log(`  description: ${product.description || 'bos'}`);
        console.log(`  country_of_origin: ${product.country_of_origin || 'bos'}`);

        // Product quantity tablosu
        const quantity = sqliteService.queryOne(`
            SELECT id, product_id, quantity, supplier 
            FROM product_quantity 
            WHERE product_id = 19822
        `);

        console.log('\nproduct_quantity (product_id=19822):');
        if (quantity) {
            console.log(`  ID: ${quantity.id}`);
            console.log(`  quantity: ${quantity.quantity}`);
            console.log(`  supplier: ${quantity.supplier}`);
        } else {
            console.log('  Kayit bulunamadi');
        }

        // Beklenen değerler
        const expectedSubName = 'Et Bebek 20 Cm';
        const expectedSubName2 = ' 20 Cm';
        const expectedDescription = 'LMN205 - Et Bebek 20 Cm Poşetli';
        const expectedCountry = 'Poşetli';
        const expectedQuantity = 100;

        if (product.sub_name === expectedSubName &&
            product.sub_name2 === expectedSubName2 &&
            product.description === expectedDescription &&
            product.country_of_origin === expectedCountry &&
            quantity && quantity.quantity === expectedQuantity) {
            console.log('\n✓ TEST BASARILI! Tum alanlar dogru guncellendi.');
        } else {
            console.log('\n❌ Bazi alanlar guncellenemedi.');
        }

        sqliteService.disconnect();

    } catch (error) {
        console.error('Hata:', error);
    }
}

verifyFinalUpdate();
