require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function investigateTrigger() {
    let output = '';

    function log(msg) {
        output += msg + '\n';
        console.log(msg);
    }

    try {
        // sync_queue'daki entity_type dağılımı
        const entityTypes = await pgService.query(`
            SELECT entity_type, status, COUNT(*) as cnt
            FROM sync_queue
            GROUP BY entity_type, status
            ORDER BY entity_type, status
        `);

        log('=== SYNC QUEUE ENTITY TYPE DAGILIMI ===');
        entityTypes.forEach(e => {
            log(`${e.entity_type} | ${e.status} | ${e.cnt} kayit`);
        });

        // entegra_product_manual trigger kontrolü
        const manualTriggers = await pgService.query(`
            SELECT tgname, tgenabled
            FROM pg_trigger 
            JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
            WHERE relname = 'entegra_product_manual'
            AND NOT tgisinternal
        `);

        log('\n=== entegra_product_manual TRIGGERLARI ===');
        log('Trigger sayisi: ' + manualTriggers.length);
        manualTriggers.forEach(t => {
            log('Trigger: ' + t.tgname + ' | Enabled: ' + t.tgenabled);
        });

        // Problematik kayıtları göster
        const problemRecords = await pgService.query(`
            SELECT id, entity_type, entity_id, status, operation
            FROM sync_queue
            WHERE entity_type NOT IN ('satis', 'satislar', 'tahsilat', 'alis', 'alislar', 'iade', 'stok_hareket', 'stok_hareketleri', 'stoklar', 'stok', 'urun_barkodlari', 'barkod', 'cari', 'cari_hesaplar', 'cari_hesap_hareketleri')
            LIMIT 20
        `);

        log('\n=== DESTEKLENMEYEN ENTITY TYPE KAYITLARI ===');
        log('Kayit sayisi: ' + problemRecords.length);
        problemRecords.forEach(p => {
            log(`ID: ${p.id} | Tip: ${p.entity_type} | Status: ${p.status}`);
        });

        // Sonuçları dosyaya yaz
        fs.writeFileSync('investigation_result.txt', output, 'utf8');
        log('\nSonuclar investigation_result.txt dosyasina yazildi.');

    } catch (error) {
        log('Hata: ' + error.message);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

investigateTrigger();
