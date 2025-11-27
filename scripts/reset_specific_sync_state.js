const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

(async () => {
    try {
        const tables = ['CARI_HESAP_HAREKETLERI', 'STOK_HAREKETLERI'];
        logger.info('Resetting sync state for tables:', tables.join(', '));

        await pgService.query(`
            UPDATE sync_state 
            SET son_senkronizasyon_zamani = NULL 
            WHERE tablo_adi = ANY($1) AND yon = 'erp_to_web'
        `, [tables]);

        logger.info('Sync state reset successfully.');
    } catch (err) {
        logger.error('Error resetting sync state:', err);
    } finally {
        await pgService.disconnect();
    }
})();
