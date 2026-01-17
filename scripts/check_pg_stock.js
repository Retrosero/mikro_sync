require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkPG() {
    const productCode = '6056902';
    try {
        console.log(`PostgreSQL'de (xmlurunler) ürün kontrol ediliyor: ${productCode}`);
        const res = await pgService.query('SELECT product_code, stock, updated_at FROM xmlurunler WHERE product_code = $1', [productCode]);
        console.log('xmlurunler Sonucu:', JSON.stringify(res, null, 2));

        console.log(`PostgreSQL'de (entegra_product) ürün kontrol ediliyor: ${productCode}`);
        const res2 = await pgService.query('SELECT "productCode", stock, quantity FROM entegra_product WHERE "productCode" = $1', [productCode]);
        console.log('entegra_product Sonucu:', JSON.stringify(res2, null, 2));

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        process.exit(0);
    }
}

checkPG();
