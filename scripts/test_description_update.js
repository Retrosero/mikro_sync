require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');

async function testDescriptionUpdate() {
    try {
        console.log('=== description GUNCELLEME TEST ===\n');

        // Mevcut değerleri kontrol et
        sqliteService.connect(true);
        const currentProduct = sqliteService.queryOne(`
            SELECT id, productCode, sub_name FROM product WHERE id = 19822
        `);
        const currentDesc = sqliteService.queryOne(`
            SELECT description FROM product_description WHERE product_id = 19822
        `);
        sqliteService.disconnect();

        console.log('Mevcut degerler:');
        console.log(`  sub_name: ${currentProduct.sub_name}`);
        console.log(`  description: ${currentDesc.description}`);

        // Test için yeni değerler
        const newSubName = 'TEST URUN ADI';
        const newDescription = 'TEST ACIKLAMA METNI';

        console.log('\nYeni degerler:');
        console.log(`  sub_name: ${newSubName}`);
        console.log(`  description: ${newDescription}`);

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
                product_id: 19822,
                sync_type: 'entegra_product_update',
                productCode: currentProduct.productCode,
                changes: {
                    sub_name: { old: currentProduct.sub_name, new: newSubName },
                    description: { old: currentDesc.description, new: newDescription }
                },
                updated_at: new Date().toISOString()
            },
            '19822'
        ]);

        console.log(`Test kaydi eklendi: ${insertResult[0].id}`);
        console.log('\nWorker calistirildiginda:');
        console.log('  - sub_name -> product tablosuna');
        console.log('  - description -> product_description tablosuna yazilacak');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

testDescriptionUpdate();
