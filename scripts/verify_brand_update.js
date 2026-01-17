require('dotenv').config();
const sqliteService = require('../services/sqlite.service');

function verifyBrandUpdate() {
    try {
        console.log('=== SQLite DOGRULAMA ===\n');

        sqliteService.connect(true);

        const product = sqliteService.queryOne(`
            SELECT id, productCode, brand_id FROM product WHERE id = 19812
        `);

        console.log('product ID=19812:');
        console.log(`  Code: ${product.productCode}`);
        console.log(`  brand_id: ${product.brand_id || 'NULL'}`);

        if (product.brand_id) {
            const brand = sqliteService.queryOne(`SELECT id, name FROM brand WHERE id = ?`, [product.brand_id]);
            if (brand) {
                console.log(`  Marka: ${brand.name} (ID: ${brand.id})`);
            }
        }

        // Beklenen değer
        if (product.brand_id === 258) {
            console.log('\n✓ TEST BASARILI! brand_id dogru guncellendi (258).');
        } else {
            console.log(`\n❌ brand_id beklenen degerde degil. Mevcut: ${product.brand_id}, Beklenen: 258`);
        }

        sqliteService.disconnect();

    } catch (error) {
        console.error('Hata:', error);
    }
}

verifyBrandUpdate();
