require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');

async function testBrandUpdate() {
    try {
        console.log('=== MARKA GÜNCELLEMESİ TEST ===\n');

        // Mevcut değerleri kontrol et
        sqliteService.connect(true);
        const currentProduct = sqliteService.queryOne(`
            SELECT id, productCode, brand_id FROM product WHERE id = 19812
        `);

        let currentBrandName = 'YOK';
        if (currentProduct.brand_id) {
            const currentBrand = sqliteService.queryOne(`SELECT name FROM brand WHERE id = ?`, [currentProduct.brand_id]);
            if (currentBrand) currentBrandName = currentBrand.name;
        }

        sqliteService.disconnect();

        console.log('Mevcut degerler:');
        console.log(`  Product Code: ${currentProduct.productCode}`);
        console.log(`  brand_id: ${currentProduct.brand_id || 'NULL'}`);
        console.log(`  Marka: ${currentBrandName}`);

        // Test için yeni marka ID'si (farklı bir marka)
        const newBrandId = currentProduct.brand_id === 258 ? 429 : 258;

        console.log('\nYeni degerler:');
        console.log(`  brand_id: ${newBrandId}`);

        // sync_queue'ya test kaydı ekle
        console.log('\n--- sync_queue\'ya test kaydi ekleniyor ---');
        const insertResult = await pgService.query(`
            INSERT INTO sync_queue (entity_type, entity_id, operation, status, record_data, record_id, created_at)
            VALUES (
                'entegra_product', 
                gen_random_uuid(), 
                'UPDATE', 
                'pending',
                $1,
                $2,
                NOW()
            )
            RETURNING id
        `, [
            {
                product_id: 19812,
                sync_type: 'entegra_product_update',
                productCode: currentProduct.productCode,
                changes: {
                    brand: { old: currentProduct.brand_id, new: newBrandId }
                },
                updated_at: new Date().toISOString()
            },
            '19812'
        ]);

        console.log(`Test kaydi eklendi: ${insertResult[0].id}`);
        console.log('\nWorker calistirildiginda brand_id guncellenecek.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

testBrandUpdate();
