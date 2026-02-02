const pgService = require('../services/postgresql.service');

async function addToQueue() {
    try {
        const testSatisId = 'c157ace6-b19c-49b3-832e-ac4e2be90055';

        // Satış verilerini al
        const satis = await pgService.query('SELECT * FROM satislar WHERE id = $1', [testSatisId]);

        if (satis.length === 0) {
            console.log('Satış bulunamadı!');
            return;
        }

        // Queue'ya ekle
        await pgService.query(`
            INSERT INTO sync_queue (source_table, record_id, operation, record_data, priority, status, entity_type, entity_id)
            VALUES ('satislar', $1, 'INSERT', $2, 1, 'pending', 'satis', $3)
        `, [testSatisId, JSON.stringify(satis[0]), testSatisId]);

        console.log('✓ Satış queue\'ya eklendi');
        console.log('Şimdi sync komutunu çalıştırın: node web-to-erp-sync.js sync');

    } catch (error) {
        console.error('HATA:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

addToQueue();
