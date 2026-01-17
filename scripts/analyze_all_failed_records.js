require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

async function analyzeAllFailedRecords() {
    let output = '';
    function log(msg) {
        output += msg + '\n';
        console.log(msg);
    }

    try {
        // Pending entegra_product kayıtlarını al
        const records = await pgService.query(`
            SELECT id, entity_id, record_data, status, error_message
            FROM sync_queue 
            WHERE entity_type = 'entegra_product' 
            AND status = 'pending'
            ORDER BY created_at DESC
        `);

        log(`=== ${records.length} ADET PENDING entegra_product KAYDI ===\n`);

        records.forEach((record, index) => {
            log(`--- KAYIT ${index + 1} ---`);
            log(`ID: ${record.id}`);

            const changes = record.record_data.changes || {};
            log('Değişen alanlar:');
            Object.keys(changes).forEach(field => {
                log(`  ${field}: ${JSON.stringify(changes[field].old)} -> ${JSON.stringify(changes[field].new)}`);
            });
            log('');
        });

        // SQLite'da brand ve product_prices tablolarını kontrol et
        sqliteService.connect(true);

        log('\n=== SQLite brand TABLO YAPISI ===');
        const brandSchema = sqliteService.getTableSchema('brand');
        brandSchema.forEach(col => {
            log(`  ${col.name}: ${col.type} ${col.pk ? '(PK)' : ''}`);
        });

        log('\n=== SQLite product_prices TABLO YAPISI ===');
        const pricesSchema = sqliteService.getTableSchema('product_prices');
        pricesSchema.forEach(col => {
            log(`  ${col.name}: ${col.type} ${col.pk ? '(PK)' : ''}`);
        });

        // Örnek veriler
        log('\n=== brand ORNEK VERI (ilk 3) ===');
        const brandSample = sqliteService.query(`SELECT * FROM brand LIMIT 3`);
        brandSample.forEach(b => {
            log(`  ID: ${b.id}, Name: ${b.name}`);
        });

        log('\n=== product_prices ORNEK VERI (product_id=19822) ===');
        const pricesSample = sqliteService.query(`SELECT * FROM product_prices WHERE product_id = 19822`);
        if (pricesSample.length > 0) {
            log(JSON.stringify(pricesSample[0], null, 2));
        } else {
            log('  Kayıt bulunamadı');
            const generalPrice = sqliteService.query(`SELECT * FROM product_prices LIMIT 1`);
            if (generalPrice.length > 0) {
                log('\n=== GENEL ORNEK (ilk kayıt) ===');
                log(JSON.stringify(generalPrice[0], null, 2));
            }
        }

        sqliteService.disconnect();

        fs.writeFileSync('failed_records_full_analysis.txt', output, 'utf8');
        log('\nAnaliz tamamlandı.');

    } catch (error) {
        log('Hata: ' + error.message);
        console.error(error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

analyzeAllFailedRecords();
