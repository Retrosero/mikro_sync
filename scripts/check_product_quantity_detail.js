require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

async function checkProductQuantity() {
    try {
        // SQLite bağlantısını aç
        sqliteService.connect(true); // readonly modunda aç

        const output = [];

        // product_quantity tablosunda toplam kayıt sayısı
        const countResult = sqliteService.query("SELECT COUNT(*) as cnt FROM product_quantity");
        output.push(`product_quantity toplam kayit: ${countResult[0].cnt}`);

        // product_quantity örnek kayıtlar
        const sampleQuantity = sqliteService.query("SELECT * FROM product_quantity LIMIT 5");
        output.push('\nproduct_quantity ornek kayitlar:');
        output.push(JSON.stringify(sampleQuantity, null, 2));

        // KS-758 product id = 3500, product_id ile ara
        const ks758Quantity = sqliteService.query("SELECT * FROM product_quantity WHERE product_id = 3500");
        output.push('\nKS-758 (product_id=3500) stok kaydi:');
        output.push(JSON.stringify(ks758Quantity, null, 2));

        // Veya id = 3500 olarak ara
        const ks758QuantityById = sqliteService.query("SELECT * FROM product_quantity WHERE id = 3500");
        output.push('\nKS-758 (id=3500) stok kaydi:');
        output.push(JSON.stringify(ks758QuantityById, null, 2));

        // Farklı bir ürün için kontrol edelim - product_id 1 ile 100 arası
        const anyQuantity = sqliteService.query("SELECT * FROM product_quantity WHERE product_id BETWEEN 1 AND 100 LIMIT 5");
        output.push('\nproduct_id 1-100 arasi ornekler:');
        output.push(JSON.stringify(anyQuantity, null, 2));

        fs.writeFileSync('quantity_check.txt', output.join('\n'), 'utf8');
        console.log('Sonuclar quantity_check.txt dosyasina yazildi');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        sqliteService.disconnect();
        process.exit(0);
    }
}

checkProductQuantity();
