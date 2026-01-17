require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

async function testEntegraProductManualSync() {
    let output = '';
    function log(msg) {
        output += msg + '\n';
        console.log(msg);
    }

    try {
        log('=== entegra_product_manual SYNC TEST ===\n');

        // 1. SQLite'da bir ürün seç (product_quantity tablosundan)
        sqliteService.connect(true);

        // Örnek product_quantity kaydı
        const samplePQ = sqliteService.queryOne(`SELECT * FROM product_quantity LIMIT 1`);
        log('--- Ornek product_quantity kaydi ---');
        log(JSON.stringify(samplePQ, null, 2));

        sqliteService.disconnect();

        if (!samplePQ) {
            log('Test icin uygun urun bulunamadi.');
            return;
        }

        const testProductId = samplePQ.id;
        const currentQuantity = samplePQ.quantity;
        const newQuantity = currentQuantity + 1;

        log(`\nTest edilecek urun ID: ${testProductId}`);
        log(`Mevcut Miktar: ${currentQuantity}`);
        log(`Yeni miktar: ${newQuantity}`);

        // sync_queue'ya test kaydı ekle - entity_id UUID olmalı, record_data içinde product_id INTEGER
        log('\n--- sync_queue\'ya test kaydi ekleniyor ---');
        const insertResult = await pgService.query(`
            INSERT INTO sync_queue (entity_type, entity_id, operation, status, record_data, record_id, created_at)
            VALUES (
                'entegra_product_manual', 
                gen_random_uuid(), 
                'UPDATE', 
                'pending',
                $1,
                $2,
                NOW()
            )
            RETURNING id, entity_id
        `, [
            {
                product_id: testProductId.toString(),
                quantity: newQuantity,
                sync_type: 'sqlite_only',
                updated_at: new Date().toISOString()
            },
            testProductId.toString()
        ]);

        log(`Test kaydi eklendi:`);
        log(`  ID: ${insertResult[0].id}`);
        log(`  Entity ID: ${insertResult[0].entity_id}`);

        // Mevcut pending kayitlari goster
        log('\n--- Mevcut pending entegra_product_manual kayitlari ---');
        const pending = await pgService.query(`
            SELECT id, entity_id, record_id, status 
            FROM sync_queue 
            WHERE status = 'pending' AND entity_type = 'entegra_product_manual'
        `);
        pending.forEach(p => log(`  ${p.id}: record_id=${p.record_id}`));

        log('\n=== TEST KAYDI EKLENDI ===');
        log('Simdi sync queue worker calistiriliyor...');

        fs.writeFileSync('test_sync_result.txt', output, 'utf8');

    } catch (error) {
        log('Hata: ' + error.message);
        console.error(error);
        fs.writeFileSync('test_sync_result.txt', output, 'utf8');
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

testEntegraProductManualSync();
