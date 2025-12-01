require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');
const path = require('path');

async function fixSyncQueue() {
    try {
        console.log('Sync Queue tablosu düzeltiliyor...');
        console.log('='.repeat(70));

        // SQL dosyasını oku
        const sqlPath = path.join(__dirname, 'fix-sync-queue-table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // SQL'i çalıştır
        await pgService.query(sql);

        console.log('✓ Sync queue tablosu başarıyla düzeltildi!');
        console.log('='.repeat(70));

        // Tabloyu kontrol et
        const columns = await pgService.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sync_queue'
      ORDER BY ordinal_position
    `);

        console.log('\nTablo Yapısı:');
        columns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

    } catch (error) {
        console.error('✗ Hata:', error.message);
        throw error;
    } finally {
        await pgService.disconnect();
    }
}

fixSyncQueue();
