require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');

async function testEntegraProductSync() {
    try {
        console.log('=== entegra_product SYNC TEST ===\n');

        // SQLite'da bir ürün seç
        sqliteService.connect(true);
        const testProduct = sqliteService.queryOne(`
            SELECT id, productCode, productName, gtin, sub_name2, country_of_origin 
            FROM product 
            WHERE id = 19822
        `);
        sqliteService.disconnect();

        if (!testProduct) {
            console.log('Test urunu (ID=19822) bulunamadi.');
            return;
        }

        console.log('Test edilecek urun:');
        console.log(`  ID: ${testProduct.id}`);
        console.log(`  Code: ${testProduct.productCode}`);
        console.log(`  Name: ${testProduct.productName}`);
        console.log(`  GTIN: ${testProduct.gtin || 'bos'}`);
        console.log(`  sub_name2: ${testProduct.sub_name2 || 'bos'}`);
        console.log(`  country_of_origin: ${testProduct.country_of_origin || 'bos'}`);

        // Test için yeni değerler
        const newGtin = 'TEST123456789';
        const newSubName2 = 'TEST ALT ISIM';
        const newCountry = 'TEST ULKE';

        console.log('\nYeni degerler:');
        console.log(`  GTIN: ${newGtin}`);
        console.log(`  sub_name2: ${newSubName2}`);
        console.log(`  country_of_origin: ${newCountry}`);

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
            RETURNING id, entity_id
        `, [
            {
                product_id: testProduct.id.toString(),
                sync_type: 'entegra_product_update',
                productCode: testProduct.productCode,
                productName: testProduct.productName,
                changes: {
                    gtin: { old: testProduct.gtin, new: newGtin },
                    sub_name2: { old: testProduct.sub_name2, new: newSubName2 },
                    country_of_origin: { old: testProduct.country_of_origin, new: newCountry }
                },
                updated_at: new Date().toISOString()
            },
            testProduct.id.toString()
        ]);

        console.log(`Test kaydi eklendi: ${insertResult[0].id}`);
        console.log('\nWorker calistirildiginda bu kayit SQLite\'a yazilacak.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

testEntegraProductSync();
