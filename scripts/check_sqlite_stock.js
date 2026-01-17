const sqlite3 = require('better-sqlite3');
const path = require('path');

const dbPath = 'c:/Users/Gürbüz Oyuncak/Documents/GitHub/mikro_sync/db.s3db';
const db = new sqlite3(dbPath);

function checkSQLite() {
    const productCode = '6056902';
    try {
        console.log(`SQLite'da ürün kontrol ediliyor: ${productCode}`);

        const product = db.prepare('SELECT * FROM product WHERE product_code = ?').get(productCode);
        console.log('Product tablosu:', JSON.stringify(product, null, 2));

        if (product) {
            const quantity = db.prepare('SELECT * FROM product_quantity WHERE product_id = ?').get(product.id);
            console.log('Product_quantity tablosu:', JSON.stringify(quantity, null, 2));
        } else {
            console.log('Ürün SQLite product tablosunda bulunamadı.');
        }

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        db.close();
    }
}

checkSQLite();
