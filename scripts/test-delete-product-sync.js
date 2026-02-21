/**
 * Test: Silinen ürün senkronizasyonu
 * Bu script syncDeletedProducts fonksiyonunu test eder
 */
require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');

async function test() {
    try {
        console.log('=== DELETE PRODUCT SYNC TEST ===\n');

        // 1. SQLite bağlantısı
        sqliteService.connect(true); // readonly
        console.log('✓ SQLite bağlantısı açıldı');

        // 2. delete_product tablosundaki sync=0 kayıt sayısı
        const unsyncedCount = sqliteService.queryOne(
            "SELECT COUNT(*) as cnt FROM delete_product WHERE sync = 0 AND supplier != 'deleteCdnPicture'"
        );
        console.log(`\nSenkronize edilmemiş silinen ürün: ${unsyncedCount.cnt}`);

        // 3. Örnek kayıtlar
        console.log('\n--- Örnek delete_product kayıtları (ilk 5) ---');
        const samples = sqliteService.query(
            "SELECT dp.*, p.productCode FROM delete_product dp LEFT JOIN product p ON dp.product_id = p.id WHERE dp.sync = 0 AND dp.supplier != 'deleteCdnPicture' ORDER BY dp.id DESC LIMIT 5"
        );
        for (const s of samples) {
            console.log(`  id=${s.id} product_id=${s.product_id} supplier=${s.supplier} productCode=${s.productCode || 'N/A'}`);
        }

        sqliteService.disconnect();

        // 4. PostgreSQL bağlantı test
        await pgService.query('SELECT 1');
        console.log('\n✓ PostgreSQL bağlantısı başarılı');

        // 5. entegra_product sayısı
        const epCount = await pgService.queryOne('SELECT COUNT(*) as cnt FROM entegra_product');
        console.log(`entegra_product kayıt sayısı: ${epCount.cnt}`);

        // 6. entegra_product_delete tablosu var mı?
        const pdTable = await pgService.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'entegra_product_delete'
            ) as exists
        `);
        console.log(`entegra_product_delete tablosu mevcut: ${pdTable[0].exists}`);

        if (pdTable[0].exists) {
            const pdCount = await pgService.queryOne('SELECT COUNT(*) as cnt FROM entegra_product_delete');
            console.log(`entegra_product_delete kayıt sayısı: ${pdCount.cnt}`);
        }

        // 7. Eşleşme kontrolü - kaç delete_product kaydının entegra_product'ta karşılığı var?
        sqliteService.connect(true);
        const matchCheck = sqliteService.query(
            "SELECT dp.product_id, p.productCode FROM delete_product dp JOIN product p ON dp.product_id = p.id WHERE dp.sync = 0 AND dp.supplier != 'deleteCdnPicture' AND p.productCode IS NOT NULL LIMIT 10"
        );

        console.log('\n--- Entegra_product eşleşme kontrolü ---');
        let matchCount = 0;
        for (const m of matchCheck) {
            const exists = await pgService.queryOne(
                'SELECT id FROM entegra_product WHERE "productCode" = $1',
                [m.productCode]
            );
            const status = exists ? '✓ BULUNDU' : '✗ YOK';
            console.log(`  productCode=${m.productCode}: ${status}`);
            if (exists) matchCount++;
        }
        console.log(`\n${matchCheck.length} kontrolden ${matchCount} tanesi entegra_product'ta mevcut`);

        sqliteService.disconnect();
        await pgService.disconnect();

        console.log('\n=== TEST TAMAMLANDI ===');

    } catch (error) {
        console.error('Test hatası:', error.message);
        console.error(error.stack);
        try { sqliteService.disconnect(); } catch (e) { }
        try { await pgService.disconnect(); } catch (e) { }
    }
}

test();
