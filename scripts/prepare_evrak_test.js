const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function prepareEvrakTest() {
    console.log('='.repeat(60));
    console.log('EVRAK NUMARASI UPDATE TESTİ');
    console.log('='.repeat(60));

    try {
        const testSatisId = 'c157ace6-b19c-49b3-832e-ac4e2be90055';

        // 1. Web'deki satışı ST-001 yapalım
        console.log('\n1. Web satışı sıfırlanıyor (ST-001)...');
        await pgService.query(`
            UPDATE satislar 
            SET fatura_seri_no = 'ST', fatura_sira_no = 1, belge_no = 'ST1' 
            WHERE id = $1
        `, [testSatisId]);
        console.log('   ✓ Web: ST-1');

        // 2. Mapping'i silelim ki yeniden sync olsun
        console.log('\n2. Mapping siliniyor...');
        await pgService.query('DELETE FROM int_satis_mapping WHERE web_satis_id = $1', [testSatisId]);

        // 3. Queue'ya ekleyelim
        console.log('\n3. Queue\'ya ekleniyor...');
        const satis = await pgService.query('SELECT * FROM satislar WHERE id = $1', [testSatisId]);

        await pgService.query(`
            INSERT INTO sync_queue (source_table, record_id, operation, record_data, priority, status, entity_type, entity_id)
            VALUES ('satislar', $1, 'INSERT', $2, 1, 'pending', 'satis', $3)
        `, [testSatisId, JSON.stringify(satis[0]), testSatisId]);

        console.log('   ✓ Queue hazır');

        console.log('\n4. Mevcut ERP Evrak Numarası ne olacak?');
        // Önceki testlerden dolayı ERP'de kayıtlar var, muhtemelen yeni numara alacak.
        // Amaç, Web'deki ST-1'in değiştiğini görmek.

        console.log('\nHAZIR! Şimdi: node web-to-erp-sync.js sync');

    } catch (error) {
        console.error('HATA:', error.message);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

prepareEvrakTest();
