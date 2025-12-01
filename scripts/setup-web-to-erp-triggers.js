require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pgService = require('../services/postgresql.service');

async function setupTriggers() {
    try {
        console.log('Web -> ERP Sync Trigger\'ları kuruluyor...');
        console.log('='.repeat(70));

        // SQL dosyasını oku
        const sqlPath = path.join(__dirname, 'setup-web-to-erp-triggers.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // SQL'i çalıştır
        await pgService.query(sql);

        console.log('✓ Trigger\'lar başarıyla kuruldu!');
        console.log('='.repeat(70));

        // Sync queue tablosunu kontrol et
        const queueCheck = await pgService.query(`
      SELECT COUNT(*) as count FROM sync_queue
    `);
        console.log(`Sync queue tablosu hazır (${queueCheck[0].count} kayıt)`);

        // Trigger'ları kontrol et
        const triggers = await pgService.query(`
      SELECT 
        trigger_name,
        event_object_table,
        action_timing,
        event_manipulation
      FROM information_schema.triggers
      WHERE trigger_name IN ('satis_sync_trigger', 'tahsilat_sync_trigger')
      ORDER BY event_object_table
    `);

        if (triggers.length > 0) {
            console.log('\nKurulu Trigger\'lar:');
            triggers.forEach(t => {
                console.log(`  ✓ ${t.trigger_name} -> ${t.event_object_table} (${t.action_timing} ${t.event_manipulation})`);
            });
        } else {
            console.log('\n⚠ Uyarı: Trigger\'lar bulunamadı. Satislar ve tahsilatlar tabloları mevcut değil olabilir.');
        }

    } catch (error) {
        console.error('✗ Trigger kurulum hatası:', error.message);
        throw error;
    } finally {
        await pgService.disconnect();
    }
}

setupTriggers();
