const pgService = require('./services/postgresql.service');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        console.log('Satislar tablosu trigger kontrolu baslatiliyor...');

        // 1. Mevcut trigger'lari kontrol et
        const triggers = await pgService.query(`
            SELECT trigger_name, event_manipulation, action_timing
            FROM information_schema.triggers
            WHERE event_object_table = 'satislar'
            ORDER BY trigger_name
        `);
        console.log('Mevcut satislar triggerlari:', triggers.length);
        triggers.forEach(t => console.log(`  - ${t.trigger_name} (${t.event_manipulation})`));

        // 2. Eski trigger'lari kaldir
        console.log('\nEski triggerlar kaldiriliyor...');
        await pgService.query(`DROP TRIGGER IF EXISTS trigger_satislar_sync ON satislar`);
        await pgService.query(`DROP TRIGGER IF EXISTS trigger_satislar_sync_unified ON satislar`);
        await pgService.query(`DROP TRIGGER IF EXISTS notify_satis_sync_trigger ON satislar`);
        console.log('Eski triggerlar kaldirildi.');

        // 3. Yeni trigger'lari olustur
        console.log('\nYeni triggerlar olusturuluyor...');

        // INSERT trigger
        await pgService.query(`
            CREATE TRIGGER trigger_satislar_sync_insert
            AFTER INSERT ON satislar
            FOR EACH ROW
            EXECUTE FUNCTION notify_satis_sync()
        `);
        console.log('  - INSERT trigger olusturuldu');

        // UPDATE trigger
        await pgService.query(`
            CREATE TRIGGER trigger_satislar_sync_update
            AFTER UPDATE ON satislar
            FOR EACH ROW
            EXECUTE FUNCTION notify_satis_sync()
        `);
        console.log('  - UPDATE trigger olusturuldu');

        // 4. Mevcut aktarilmamis satislari sync_queue'ya ekle
        console.log('\nAktarilmamis satislar sync_queue ya ekleniyor...');

        // Once mevcut pending satis kayitlarini kontrol et
        const existingPending = await pgService.query(`
            SELECT entity_id FROM sync_queue
            WHERE entity_type = 'satis' AND status = 'pending'
        `);
        const existingIds = new Set(existingPending.map(r => r.entity_id));
        console.log(`Mevcut pending satis kaydi: ${existingIds.size}`);

        // Aktarilmamis satislari bul
        const unmappedSatis = await pgService.query(`
            SELECT s.id, s.satis_no, s.fatura_seri_no, s.fatura_sira_no, s.erp_rec_no
            FROM satislar s
            LEFT JOIN int_satis_mapping m ON s.id = m.web_satis_id
            WHERE m.web_satis_id IS NULL
              AND (s.kaynak IS NULL OR s.kaynak = 'web')
            ORDER BY s.id DESC
        `);
        console.log(`Aktarilmamis satis sayisi: ${unmappedSatis.length}`);

        // Sync_queue'ya ekle
        let addedCount = 0;
        for (const satis of unmappedSatis) {
            if (existingIds.has(satis.id)) {
                continue; // Zaten var, atla
            }

            try {
                await pgService.query(`
                    INSERT INTO sync_queue (entity_type, entity_id, operation, status, record_data)
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    'satis',
                    satis.id,
                    'INSERT',
                    'pending',
                    JSON.stringify({
                        fatura_no: satis.satis_no,
                        seri: satis.fatura_seri_no,
                        sira: satis.fatura_sira_no,
                        erp_rec_no: satis.erp_rec_no
                    })
                ]);
                addedCount++;
            } catch (err) {
                console.error(`  Hata (${satis.id}):`, err.message);
            }
        }
        console.log(`Sync_queue'a eklenen yeni kayit: ${addedCount}`);

        // 5. Sonuc kontrolu
        const finalTriggers = await pgService.query(`
            SELECT trigger_name, event_manipulation
            FROM information_schema.triggers
            WHERE event_object_table = 'satislar'
            ORDER BY trigger_name
        `);
        console.log('\n=== SONUC ===');
        console.log('Satislar tablosu triggerlari:');
        finalTriggers.forEach(t => console.log(`  - ${t.trigger_name} (${t.event_manipulation})`));

        const queueCount = await pgService.query(`
            SELECT COUNT(*) as count FROM sync_queue WHERE entity_type = 'satis' AND status = 'pending'
        `);
        console.log(`\nSync_queue'da bekleyen satis kaydi: ${queueCount[0].count}`);

        console.log('\n✅ Islem tamamlandi!');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
    }
}

main();
