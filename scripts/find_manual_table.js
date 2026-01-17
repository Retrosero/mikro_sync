require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function findManualTable() {
    let output = '';
    function log(msg) {
        output += msg + '\n';
    }

    try {
        // Tum public tablolari listele
        log('=== PUBLIC SCHEMA TABLOLARI (product iceren) ===');
        const productTables = await pgService.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name LIKE '%product%'
            ORDER BY table_name
        `);
        productTables.forEach(t => log(`  ${t.table_name}`));

        // sync_queue'daki unique entity_type'lar
        log('\n=== sync_queue daki TUM entity_type\'lar ===');
        const entityTypes = await pgService.query(`
            SELECT DISTINCT entity_type, COUNT(*) as cnt
            FROM sync_queue
            GROUP BY entity_type
            ORDER BY entity_type
        `);
        entityTypes.forEach(e => log(`  ${e.entity_type}: ${e.cnt} kayit`));

        // Son sync_queue kaydı (entegra_product_manual)
        log('\n=== Son entegra_product_manual kaydi detay ===');
        const lastRecord = await pgService.query(`
            SELECT * FROM sync_queue 
            WHERE entity_type = 'entegra_product_manual'
            ORDER BY created_at DESC
            LIMIT 1
        `);
        if (lastRecord.length > 0) {
            log(JSON.stringify(lastRecord[0], null, 2));

            // Bu entity_id ile ilgili veri var mi kontrol et
            const entityId = lastRecord[0].entity_id;
            log(`\nEntity ID: ${entityId}`);

            // entegra_product_quantity tablosunda bu ID ile kayit var mi
            const quantityRecord = await pgService.query(`
                SELECT * FROM entegra_product_quantity WHERE id = $1
            `, [entityId]);

            if (quantityRecord.length > 0) {
                log('\nentegra_product_quantity\'da bu ID ile kayit bulundu:');
                log(JSON.stringify(quantityRecord[0], null, 2));
            } else {
                log('\nentegra_product_quantity\'da bu ID ile kayit bulunamadi');

                // UUID mi INTEGER mi kontrol et
                const isUuid = entityId.includes('-');
                if (!isUuid) {
                    const intQuantity = await pgService.query(`
                        SELECT * FROM entegra_product_quantity WHERE id = $1
                    `, [parseInt(entityId)]);
                    if (intQuantity.length > 0) {
                        log('INTEGER olarak sorgulandığında bulundu:');
                        log(JSON.stringify(intQuantity[0], null, 2));
                    }
                }
            }
        } else {
            log('  Kayit bulunamadi');
        }

        fs.writeFileSync('manual_table_result.txt', output, 'utf8');
        console.log('Sonuc dosyaya yazildi: manual_table_result.txt');

    } catch (error) {
        log('Hata: ' + error.message);
        fs.writeFileSync('manual_table_result.txt', output, 'utf8');
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

findManualTable();
