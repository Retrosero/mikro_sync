require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function checkAllTables() {
    let output = '';
    function log(msg) {
        output += msg + '\n';
    }

    try {
        log('=== TUM entegra TABLOLARI ===');

        const tables = await pgService.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name LIKE 'entegra%'
            ORDER BY table_name
        `);

        tables.forEach(t => log(`  ${t.table_name}`));

        log('\n=== product_manual ARASTIRMASI ===');

        // product_manual adını içeren tablolar
        const manualTables = await pgService.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name LIKE '%manual%'
        `);

        log('manual kelimesini iceren tablolar:');
        if (manualTables.length === 0) {
            log('  Bulunamadi');
        } else {
            manualTables.forEach(t => log(`  ${t.table_name}`));
        }

        // sync_queue'daki entegra_product_manual kayitlari
        log('\n=== sync_queue daki entegra_product_manual kayitlari ===');
        const queueRecords = await pgService.query(`
            SELECT id, entity_type, entity_id, operation, status, created_at 
            FROM sync_queue 
            WHERE entity_type = 'entegra_product_manual'
            ORDER BY created_at DESC
            LIMIT 5
        `);

        if (queueRecords.length === 0) {
            log('  Kayit bulunamadi');
        } else {
            queueRecords.forEach(r => {
                log(`  ID: ${r.id}`);
                log(`  Entity ID: ${r.entity_id}`);
                log(`  Operation: ${r.operation}`);
                log(`  Status: ${r.status}`);
                log(`  Created: ${r.created_at}`);
                log('');
            });
        }

        fs.writeFileSync('all_tables_result.txt', output, 'utf8');
        console.log('Sonuc dosyaya yazildi: all_tables_result.txt');

    } catch (error) {
        log('Hata: ' + error.message);
        fs.writeFileSync('all_tables_result.txt', output, 'utf8');
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkAllTables();
