require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

function checkSpecificId() {
    let output = '';
    function log(msg) {
        output += msg + '\n';
    }

    try {
        sqliteService.connect(true);
        const id = 19792;

        log(`ID: ${id} kontrol ediliyor...`);

        // Product tablosu
        const product = sqliteService.queryOne(`SELECT * FROM product WHERE id = ?`, [id]);
        log('Product: ' + (product ? 'Bulundu' : 'Yok'));
        if (product) log(`  Name: ${product.name}, Code: ${product.productCode}`);

        // Product Quanity tablosu - ID ile
        const pq = sqliteService.queryOne(`SELECT * FROM product_quantity WHERE id = ?`, [id]);
        log('Product Quantity (by id): ' + (pq ? 'Bulundu' : 'Yok'));
        if (pq) log(JSON.stringify(pq, null, 2));

        // Product Quanity tablosu (by product_id)
        const pqByPid = sqliteService.query(`SELECT * FROM product_quantity WHERE product_id = ?`, [id]);
        log(`Product Quantity (by product_id): ${pqByPid.length} adet bulundu`);
        pqByPid.forEach(p => log(`  ID: ${p.id}, Qty: ${p.quantity}`));

        sqliteService.disconnect();

        fs.writeFileSync('check_id_result.txt', output, 'utf8');
        console.log('Sonuc dosyaya yazildi.');

    } catch (error) {
        console.error('Hata:', error);
    }
}

checkSpecificId();
