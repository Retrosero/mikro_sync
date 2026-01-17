/**
 * SQLite product_quantity tablosunu PostgreSQL entegra_product_quantity tablosuna
 * TAM olarak senkronize eder.
 */
require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

async function syncProductQuantity() {
    try {
        logger.info('='.repeat(60));
        logger.info('product_quantity TAM SENKRONIZASYON BAŞLIYOR');
        logger.info('='.repeat(60));

        // SQLite bağlantısını aç
        sqliteService.connect(true);

        // SQLite'dan tüm product_quantity kayıtlarını al
        const sqliteRows = sqliteService.query('SELECT * FROM product_quantity');
        logger.info(`SQLite'da ${sqliteRows.length} adet product_quantity kaydı bulundu`);

        if (sqliteRows.length === 0) {
            logger.warn('Aktarılacak kayıt yok');
            return;
        }

        // PostgreSQL'de hedef tabloyu temizle ve yeniden doldur
        // (UPSERT yerine TRUNCATE + INSERT daha hızlı olabilir)
        logger.info('PostgreSQL entegra_product_quantity tablosu temizleniyor...');
        await pgService.query('TRUNCATE TABLE entegra_product_quantity');

        // Batch insert
        const BATCH_SIZE = 500;
        let totalInserted = 0;

        for (let i = 0; i < sqliteRows.length; i += BATCH_SIZE) {
            const batch = sqliteRows.slice(i, i + BATCH_SIZE);

            const values = [];
            const placeholders = [];
            let paramIdx = 1;

            for (const row of batch) {
                const rowPlaceholders = [];
                for (const key of ['id', 'product_id', 'product_option_value_id', 'store_id', 'supplier', 'quantity', 'quantity2', 'sync_ai']) {
                    values.push(row[key] ?? null);
                    rowPlaceholders.push(`$${paramIdx++}`);
                }
                placeholders.push(`(${rowPlaceholders.join(', ')})`);
            }

            const sql = `
                INSERT INTO entegra_product_quantity 
                (id, product_id, product_option_value_id, store_id, supplier, quantity, quantity2, sync_ai)
                VALUES ${placeholders.join(', ')}
            `;

            await pgService.query(sql, values);
            totalInserted += batch.length;
            logger.info(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} kayıt (toplam: ${totalInserted})`);
        }

        logger.info('='.repeat(60));
        logger.info(`TAMAMLANDI: ${totalInserted} kayıt senkronize edildi`);
        logger.info('='.repeat(60));

        // KS-758 kontrolü
        const ks758Check = await pgService.query(
            'SELECT * FROM entegra_product_quantity WHERE product_id = 3500'
        );
        logger.info('KS-758 (product_id=3500) yeni stok durumu:');
        console.log(JSON.stringify(ks758Check, null, 2));

    } catch (error) {
        logger.error('Senkronizasyon hatası:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

syncProductQuantity();
