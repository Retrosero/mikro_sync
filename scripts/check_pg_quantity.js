require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function checkPgProductQuantity() {
    try {
        const output = [];

        // entegra_product_quantity tablosunda toplam kayıt sayısı
        const countResult = await pgService.query("SELECT COUNT(*) as cnt FROM entegra_product_quantity");
        output.push(`entegra_product_quantity toplam kayit: ${countResult[0].cnt}`);

        // entegra_product_quantity örnek kayıtlar
        const sampleQuantity = await pgService.query("SELECT * FROM entegra_product_quantity LIMIT 5");
        output.push('\nentegra_product_quantity ornek kayitlar:');
        output.push(JSON.stringify(sampleQuantity, null, 2));

        // KS-758 product id = 3500, product_id ile ara
        const ks758Quantity = await pgService.query("SELECT * FROM entegra_product_quantity WHERE product_id = 3500");
        output.push('\nKS-758 (product_id=3500) stok kaydi:');
        output.push(JSON.stringify(ks758Quantity, null, 2));

        // Kolon yapısı
        const cols = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_product_quantity'
            ORDER BY ordinal_position
        `);
        output.push('\nentegra_product_quantity kolon yapisi:');
        output.push(JSON.stringify(cols, null, 2));

        fs.writeFileSync('pg_quantity_check.txt', output.join('\n'), 'utf8');
        console.log('Sonuclar pg_quantity_check.txt dosyasina yazildi');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkPgProductQuantity();
