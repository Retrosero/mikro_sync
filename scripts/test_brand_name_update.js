require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');

async function testBrandNameUpdate() {
    try {
        console.log('=== MARKA ADI İLE GÜNCELLEME TEST ===\n');

        // SQLite'da bir marka seç
        sqliteService.connect(true);
        const testBrand = sqliteService.queryOne(`SELECT id, name FROM brand WHERE id = 258`);

        const currentProduct = sqliteService.queryOne(`
            SELECT id, productCode, brand_id FROM product WHERE id = 19812
        `);

        sqliteService.disconnect();

        console.log('Test markası:');
        console.log(`  ID: ${testBrand.id}`);
        console.log(`  Name: ${testBrand.name}`);

        console.log('\nMevcut product (ID=19812):');
        console.log(`  Code: ${currentProduct.productCode}`);
        console.log(`  brand_id: ${currentProduct.brand_id || 'NULL'}`);

        console.log('\nTest senaryosu:');
        console.log(`  Web'den gelen brand değeri: "${testBrand.name}"`);
        console.log(`  Beklenen brand_id: ${testBrand.id}`);

        // sync_queue'ya test kaydı ekle - brand değeri olarak marka ADI gönder
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
                    brand: { old: '', new: testBrand.name } // Marka ADI gönderiliyor
                },
                updated_at: new Date().toISOString()
            },
            '19812'
        ]);

        console.log(`Test kaydi eklendi: ${insertResult[0].id}`);
        console.log('\nWorker calistirildiginda:');
        console.log(`  1. brand tablosunda "${testBrand.name}" aranacak`);
        console.log(`  2. Bulunan ID (${testBrand.id}) product.brand_id'ye yazilacak`);

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

testBrandNameUpdate();
