require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

async function analyzeEntegraProduct() {
    let output = '';
    function log(msg) {
        output += msg + '\n';
        console.log(msg);
    }

    try {
        // 1. PostgreSQL'de entegra_product yapısı
        log('=== PostgreSQL entegra_product TABLO YAPISI ===');
        const pgColumns = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_product'
            ORDER BY ordinal_position
        `);
        pgColumns.forEach(col => {
            log(`  ${col.column_name}: ${col.data_type}`);
        });

        // 2. Örnek entegra_product verisi
        log('\n=== PostgreSQL entegra_product ORNEK VERI (ilk 2) ===');
        const samplePg = await pgService.query(`SELECT * FROM entegra_product LIMIT 2`);
        samplePg.forEach(p => {
            log(`\nID: ${p.id}`);
            log(`  productCode: ${p.productCode}`);
            log(`  name: ${p.name}`);
            log(`  barcode: ${p.barcode}`);
            log(`  modelNo: ${p.modelNo}`);
        });

        // 3. sync_queue'daki entegra_product kaydı
        log('\n=== sync_queue\'daki entegra_product kaydi ===');
        const queueRecord = await pgService.query(`
            SELECT id, entity_id, record_data, created_at
            FROM sync_queue 
            WHERE entity_type = 'entegra_product'
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (queueRecord.length > 0) {
            log(`Queue ID: ${queueRecord[0].id}`);
            log(`Entity ID: ${queueRecord[0].entity_id}`);
            log('Record Data:');
            log(JSON.stringify(queueRecord[0].record_data, null, 2));
        }

        // 4. SQLite product tablosu yapısı
        sqliteService.connect(true);
        log('\n=== SQLite product TABLO YAPISI ===');
        const sqliteSchema = sqliteService.getTableSchema('product');
        sqliteSchema.forEach(col => {
            log(`  ${col.name}: ${col.type} ${col.pk ? '(PK)' : ''}`);
        });

        // 5. SQLite product örnek veri
        log('\n=== SQLite product ORNEK VERI (ilk 2) ===');
        const sqliteSample = sqliteService.query(`SELECT * FROM product LIMIT 2`);
        sqliteSample.forEach(p => {
            log(`\nID: ${p.id}`);
            log(`  productCode: ${p.productCode}`);
            log(`  productName: ${p.productName}`);
        });

        sqliteService.disconnect();

        fs.writeFileSync('entegra_product_analysis.txt', output, 'utf8');
        log('\n=== Analiz tamamlandi, dosyaya yazildi ===');

    } catch (error) {
        log('Hata: ' + error.message);
        console.error(error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

analyzeEntegraProduct();
