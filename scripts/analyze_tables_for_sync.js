require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function analyzeTablesForSync() {
    let output = '';

    function log(msg) {
        output += msg + '\n';
        console.log(msg);
    }

    try {
        // SQLite bağlantısını aç
        sqliteService.connect(true);

        // 1. SQLite product_quantity tablo şeması
        log('=== SQLite product_quantity TABLO YAPISI ===');
        const sqliteColumns = sqliteService.getTableSchema('product_quantity');
        sqliteColumns.forEach(col => {
            log(`  ${col.name}: ${col.type} ${col.pk ? '(PK)' : ''}`);
        });

        // 2. PostgreSQL - tablo var mi kontrol et
        const tableExists = await pgService.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_name LIKE 'entegra_product%'
        `);
        log('\n=== PostgreSQL entegra_product* TABLOLARI ===');
        tableExists.forEach(t => log(`  ${t.table_name}`));

        // 3. entegra_product_manual tablo var mı?
        const manualTable = tableExists.find(t => t.table_name === 'entegra_product_manual');

        if (manualTable) {
            log('\n=== PostgreSQL entegra_product_manual TABLO YAPISI ===');
            const pgColumns = await pgService.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'entegra_product_manual'
                ORDER BY ordinal_position
            `);
            pgColumns.forEach(col => {
                log(`  ${col.column_name}: ${col.data_type}`);
            });

            // Kayıt sayısı
            const count = await pgService.query(`SELECT COUNT(*) as cnt FROM entegra_product_manual`);
            log(`\nKayit sayisi: ${count[0].cnt}`);

            // Örnek veri
            if (parseInt(count[0].cnt) > 0) {
                log('\n=== ORNEK VERI (ilk 3) ===');
                const sample = await pgService.query(`SELECT * FROM entegra_product_manual LIMIT 3`);
                log(JSON.stringify(sample, null, 2));
            }
        } else {
            log('\nentegra_product_manual tablosu bulunamadi!');
        }

        // 4. SQLite product_quantity örnek veri
        log('\n=== SQLite product_quantity ORNEK VERI (ilk 3) ===');
        const sqliteSample = sqliteService.query(`SELECT * FROM product_quantity LIMIT 3`);
        log(JSON.stringify(sqliteSample, null, 2));

        // Sonuçları dosyaya yaz
        fs.writeFileSync('table_analysis.txt', output, 'utf8');
        log('\nSonuclar table_analysis.txt dosyasina yazildi.');

    } catch (error) {
        log('Hata: ' + error.message);
        console.error(error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

analyzeTablesForSync();
