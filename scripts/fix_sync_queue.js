/**
 * Sync queue sorunlarını düzeltir:
 * 1. Desteklenmeyen entity tiplerini siler
 * 2. PENDING (büyük harf) status'ları pending (küçük harf) olarak düzeltir
 */
require('dotenv').config();
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

async function fixSyncQueue() {
    try {
        logger.info('='.repeat(60));
        logger.info('SYNC QUEUE DÜZELTME İŞLEMİ');
        logger.info('='.repeat(60));

        // 1. Desteklenmeyen entity tiplerini sil
        const unsupportedTypes = ['entegra_product_manual'];

        for (const entityType of unsupportedTypes) {
            const deleted = await pgService.query(`
                DELETE FROM sync_queue 
                WHERE entity_type = $1
                RETURNING id
            `, [entityType]);
            logger.info(`${entityType}: ${deleted.length} kayıt silindi`);
        }

        // 2. PENDING (büyük harf) -> pending (küçük harf)
        const updated = await pgService.query(`
            UPDATE sync_queue 
            SET status = LOWER(status)
            WHERE status != LOWER(status)
            RETURNING id, entity_type, status
        `);
        logger.info(`Status düzeltildi: ${updated.length} kayıt`);

        // 3. Güncel durumu göster
        const stats = await pgService.query(`
            SELECT entity_type, status, COUNT(*) as cnt
            FROM sync_queue
            GROUP BY entity_type, status
            ORDER BY entity_type, status
        `);

        logger.info('\nGüncel queue durumu:');
        console.table(stats);

    } catch (error) {
        logger.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

fixSyncQueue();
