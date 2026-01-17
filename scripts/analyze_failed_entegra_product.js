require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function analyzeFailedRecord() {
    let output = '';
    function log(msg) {
        output += msg + '\n';
        console.log(msg);
    }

    try {
        // Pending/failed entegra_product kaydını bul
        const record = await pgService.query(`
            SELECT id, entity_id, record_data, status, error_message
            FROM sync_queue 
            WHERE entity_type = 'entegra_product' 
            AND status IN ('pending', 'failed')
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (record.length === 0) {
            log('Pending/failed kayit bulunamadi.');
            return;
        }

        log('=== HATALI KAYIT ===');
        log(`ID: ${record[0].id}`);
        log(`Status: ${record[0].status}`);
        log(`Error: ${record[0].error_message || 'yok'}`);
        log('\nRecord Data:');
        log(JSON.stringify(record[0].record_data, null, 2));

        // Changes içindeki alanları analiz et
        const changes = record[0].record_data.changes || {};
        log('\n=== DEGISEN ALANLAR ===');
        Object.keys(changes).forEach(field => {
            log(`  ${field}: ${changes[field].old} -> ${changes[field].new}`);
        });

        fs.writeFileSync('failed_record_analysis.txt', output, 'utf8');
        log('\nAnaliz tamamlandi.');

    } catch (error) {
        log('Hata: ' + error.message);
        console.error(error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

analyzeFailedRecord();
