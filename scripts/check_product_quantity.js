require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');

async function checkEntegraProductQuantity() {
    try {
        // SQLite bağlantısını aç
        sqliteService.connect(true); // readonly modunda aç

        // SQLite product_quantity tablo şemasını kontrol et
        const sqliteColumns = sqliteService.getTableSchema('product_quantity');
        console.log('SQLite product_quantity tablo yapısı:');
        sqliteColumns.forEach(col => {
            console.log(`  ${col.name}: ${col.type}`);
        });

        // Product tablosundan KS-758 bilgisi
        const sqliteProductInfo = sqliteService.query(`
            SELECT id, productCode, name FROM product WHERE productCode = 'KS-758'
        `);
        console.log('\nSQLite KS-758 product bilgisi:');
        console.log(JSON.stringify(sqliteProductInfo, null, 2));

        if (sqliteProductInfo.length > 0) {
            const productId = sqliteProductInfo[0].id;

            // SQLite'da bu ürünün stok kaydı - ID ile
            const sqliteQuantity = sqliteService.query(`
                SELECT * FROM product_quantity WHERE id = ${productId}
            `);
            console.log('\nSQLite KS-758 stok kaydı (product_quantity):');
            console.log(JSON.stringify(sqliteQuantity, null, 2));
        }

        // PostgreSQL'de entegra_product tablosunda KS-758
        const pgProduct = await pgService.query(`
            SELECT id, "productCode", name 
            FROM entegra_product 
            WHERE "productCode" = 'KS-758'
        `);
        console.log('\nPostgreSQL entegra_product KS-758:');
        console.log(JSON.stringify(pgProduct, null, 2));

        if (pgProduct.length > 0) {
            const pgProductId = pgProduct[0].id;

            // PostgreSQL'de bu ürünün stok kaydı
            const pgQuantity = await pgService.query(`
                SELECT * FROM entegra_product_quantity WHERE id = $1
            `, [pgProductId]);
            console.log('\nPostgreSQL entegra_product_quantity KS-758:');
            console.log(JSON.stringify(pgQuantity, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

checkEntegraProductQuantity();
