/**
 * Tek seferlik sync queue worker - test için
 */
require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');
const logger = require('../utils/logger');

async function processEntegraProductManual() {
    try {
        console.log('=== entegra_product_manual SYNC WORKER ===\n');

        // Bekleyen entegra_product_manual kayıtlarını al
        const pendingItems = await pgService.query(`
            SELECT id, entity_type, entity_id, operation, record_data, record_id
            FROM sync_queue
            WHERE status = 'pending' AND entity_type = 'entegra_product_manual'
            ORDER BY created_at ASC
        `);

        console.log(`Bekleyen kayit sayisi: ${pendingItems.length}`);

        if (pendingItems.length === 0) {
            console.log('Islenecek kayit yok.');
            return;
        }

        for (const item of pendingItems) {
            console.log(`\n--- Isleniyor: ${item.id} ---`);

            try {
                // Durumu processing yap
                await pgService.query(
                    `UPDATE sync_queue SET status = 'processing' WHERE id = $1`,
                    [item.id]
                );

                const recordData = item.record_data;
                if (!recordData) {
                    throw new Error('record_data bulunamadi');
                }

                const productId = parseInt(recordData.product_id);
                const quantity = parseFloat(recordData.quantity) || 0;

                console.log(`  Product ID: ${productId}`);
                console.log(`  Quantity: ${quantity}`);

                if (!productId) {
                    throw new Error(`Gecersiz product_id: ${recordData.product_id}`);
                }

                // SQLite bağlantısını aç (yazma modu)
                sqliteService.connect(false);

                try {
                    // Önceki değeri al
                    const existingRecord = sqliteService.queryOne(
                        `SELECT id, quantity FROM product_quantity WHERE id = ?`,
                        [productId]
                    );

                    if (existingRecord) {
                        console.log(`  Önceki miktar: ${existingRecord.quantity}`);

                        // Güncelle
                        const result = sqliteService.run(
                            `UPDATE product_quantity SET quantity = ? WHERE id = ?`,
                            [quantity, productId]
                        );

                        console.log(`  ✓ Guncellendi! Degisiklik: ${result.changes} satir`);

                        // Doğrula
                        const verified = sqliteService.queryOne(
                            `SELECT quantity FROM product_quantity WHERE id = ?`,
                            [productId]
                        );
                        console.log(`  Yeni miktar (dogrulama): ${verified.quantity}`);
                    } else {
                        console.log(`  ❌ product_quantity tablosunda ID=${productId} bulunamadi`);
                    }
                } finally {
                    sqliteService.disconnect();
                }

                // Başarılı - durumu güncelle
                await pgService.query(
                    `UPDATE sync_queue 
                     SET status = 'completed', 
                         processed_at = NOW(),
                         error_message = NULL
                     WHERE id = $1`,
                    [item.id]
                );

                console.log(`  ✓ Tamamlandi!`);

            } catch (error) {
                console.error(`  ❌ Hata: ${error.message}`);

                // Hata - durumu güncelle
                await pgService.query(
                    `UPDATE sync_queue 
                     SET status = 'failed', 
                         processed_at = NOW(),
                         error_message = $1
                     WHERE id = $2`,
                    [error.message, item.id]
                );
            }
        }

        console.log('\n=== ISLEM TAMAMLANDI ===');

    } catch (error) {
        console.error('Genel hata:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

processEntegraProductManual();
