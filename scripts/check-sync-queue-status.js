require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkQueue() {
    try {
        console.log('Sync Queue Durumu Kontrol Ediliyor...');
        console.log('='.repeat(70));

        // İstatistikler
        const stats = await pgService.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM sync_queue
      GROUP BY status
      ORDER BY status
    `);

        console.log('\nQueue İstatistikleri:');
        let total = 0;
        stats.forEach(row => {
            console.log(`  ${row.status}: ${row.count}`);
            total += parseInt(row.count);
        });
        console.log(`  TOPLAM: ${total}`);

        // Son 10 kayıt
        const recent = await pgService.query(`
      SELECT 
        entity_type,
        operation,
        status,
        retry_count,
        created_at,
        error_message
      FROM sync_queue
      ORDER BY created_at DESC
      LIMIT 10
    `);

        console.log('\nSon 10 Kayıt:');
        recent.forEach((row, idx) => {
            console.log(`\n${idx + 1}. ${row.entity_type} (${row.operation}) - ${row.status}`);
            console.log(`   Oluşturulma: ${row.created_at}`);
            console.log(`   Retry: ${row.retry_count}`);
            if (row.error_message) {
                console.log(`   Hata: ${row.error_message.substring(0, 100)}...`);
            }
        });

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkQueue();
