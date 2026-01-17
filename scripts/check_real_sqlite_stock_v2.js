const sqlite3 = require('better-sqlite3');

const dbPath = 'C:/Ana Entegra/db.s3db';
const db = new sqlite3(dbPath, { readonly: true });

function checkRealSQLite() {
    const productCode = '6056902';
    try {
        console.log(`Real SQLite'da ürün kontrol ediliyor: ${productCode}`);

        const product = db.prepare('SELECT * FROM product WHERE productCode = ?').get(productCode);
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

checkRealSQLite();
