require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function checkKS758() {
    try {
        // SQLite bağlantısını aç
        sqliteService.connect(true); // readonly modunda aç

        const output = [];

        // product tablo şemasını kontrol et
        try {
            const productColumns = sqliteService.getTableSchema('product');
            output.push('SQLite product tablo yapisi (ilk 15 kolon):');
            productColumns.slice(0, 15).forEach(col => {
                output.push(`  ${col.name}: ${col.type}`);
            });
        } catch (e) {
            output.push('product sema hatasi: ' + e.message);
        }

        // Product tablosundan KS-758 bilgisi
        try {
            const sqliteProduct = sqliteService.query(
                "SELECT * FROM product WHERE productCode = 'KS-758' LIMIT 1"
            );
            output.push('\nSQLite KS-758 product bilgisi:');
            if (sqliteProduct.length > 0) {
                // Sadece önemli alanları göster
                const p = sqliteProduct[0];
                output.push(`  id: ${p.id}`);
                output.push(`  productCode: ${p.productCode}`);
                output.push(JSON.stringify(Object.keys(p).slice(0, 20), null, 2));
            }

            if (sqliteProduct.length > 0) {
                const productId = sqliteProduct[0].id;

                // SQLite'da bu ürünün stok kaydı
                try {
                    const sqliteQuantity = sqliteService.query(
                        `SELECT * FROM product_quantity WHERE id = ${productId}`
                    );
                    output.push('\nSQLite KS-758 stok kaydi (product_quantity):');
                    output.push(JSON.stringify(sqliteQuantity, null, 2));
                } catch (e2) {
                    output.push('product_quantity sorgu hatasi: ' + e2.message);
                }
            }
        } catch (e) {
            output.push('product sorgu hatasi: ' + e.message);
        }

        // PostgreSQL entegra_product kontrol et
        try {
            // Önce kolon adlarını kontrol et
            const pgCols = await pgService.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'entegra_product' 
                ORDER BY ordinal_position LIMIT 10
            `);
            output.push('\nPostgreSQL entegra_product kolonlari (ilk 10):');
            output.push(JSON.stringify(pgCols.map(c => c.column_name), null, 2));

            const pgProduct = await pgService.query(`
                SELECT * FROM entegra_product 
                WHERE "productCode" = 'KS-758'
            `);
            output.push('\nPostgreSQL entegra_product KS-758:');
            if (pgProduct.length > 0) {
                output.push(`  id: ${pgProduct[0].id}`);
                output.push(`  productCode: ${pgProduct[0].productCode}`);
            }

            if (pgProduct.length > 0) {
                const pgProductId = pgProduct[0].id;

                const pgQuantity = await pgService.query(`
                    SELECT * FROM entegra_product_quantity WHERE id = $1
                `, [pgProductId]);
                output.push('\nPostgreSQL entegra_product_quantity KS-758:');
                output.push(JSON.stringify(pgQuantity, null, 2));
            }
        } catch (e) {
            output.push('PostgreSQL hatasi: ' + e.message);
        }

        fs.writeFileSync('ks758_check.txt', output.join('\n'), 'utf8');
        console.log('Sonuclar ks758_check.txt dosyasina yazildi');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

checkKS758();
