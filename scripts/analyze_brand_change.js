require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');

async function analyzeBrandChange() {
    try {
        console.log('=== MARKA DEĞİŞİKLİĞİ ANALİZİ ===\n');

        // Son işlenen kaydı al
        const record = await pgService.query(`
            SELECT id, entity_id, record_data
            FROM sync_queue 
            WHERE entity_type = 'entegra_product' 
            AND record_data->>'product_id' = '19812'
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (record.length > 0) {
            console.log('Kayıt bulundu:');
            console.log(`Product ID: ${record[0].record_data.product_id}`);

            const changes = record[0].record_data.changes || {};
            if (changes.brand) {
                console.log('\nMarka değişikliği:');
                console.log(`  Eski: ${changes.brand.old}`);
                console.log(`  Yeni: ${changes.brand.new}`);
            }
        }

        // SQLite'da product ve brand tablolarını kontrol et
        sqliteService.connect(true);

        console.log('\n=== SQLite product (ID=19812) ===');
        const product = sqliteService.queryOne(`
            SELECT id, productCode, productName, brand_id FROM product WHERE id = 19812
        `);
        if (product) {
            console.log(`  Code: ${product.productCode}`);
            console.log(`  Name: ${product.productName}`);
            console.log(`  brand_id: ${product.brand_id || 'NULL'}`);

            if (product.brand_id) {
                const brand = sqliteService.queryOne(`SELECT id, name FROM brand WHERE id = ?`, [product.brand_id]);
                if (brand) {
                    console.log(`  Marka: ${brand.name} (ID: ${brand.id})`);
                }
            }
        }

        // PostgreSQL'de entegra_product tablosunu kontrol et
        console.log('\n=== PostgreSQL entegra_product (ID=19812) ===');
        const pgProduct = await pgService.query(`
            SELECT id, "productCode", "productName", brand FROM entegra_product WHERE id = 19812
        `);
        if (pgProduct.length > 0) {
            console.log(`  Code: ${pgProduct[0].productCode}`);
            console.log(`  Name: ${pgProduct[0].productName}`);
            console.log(`  brand: ${pgProduct[0].brand || 'NULL'}`);
        }

        // PostgreSQL'de entegra_brand tablosu var mı?
        console.log('\n=== PostgreSQL entegra_brand tablosu ===');
        const brands = await pgService.query(`
            SELECT id, name FROM entegra_brand ORDER BY id LIMIT 5
        `);
        console.log(`Toplam ${brands.length} örnek marka:`);
        brands.forEach(b => {
            console.log(`  ID: ${b.id}, Name: ${b.name}`);
        });

        sqliteService.disconnect();

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

analyzeBrandChange();
