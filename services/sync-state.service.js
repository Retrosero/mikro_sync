const pgService = require('./postgresql.service');
const logger = require('../utils/logger');

/**
 * Senkronizasyon durumu yönetimi için servis
 */
class SyncStateService {
    /**
     * Belirli bir tablo ve yön için son senkronizasyon zamanını getirir
     * @param {string} tableName - Tablo adı (örn: 'STOKLAR', 'satislar')
     * @param {string} direction - Yön: 'erp_to_web' veya 'web_to_erp'
     * @returns {Promise<Date|null>} Son senkronizasyon zamanı veya null
     */
    async getLastSyncTime(tableName, direction) {
        try {
            const result = await pgService.queryOne(
                `SELECT son_senkronizasyon_zamani 
         FROM sync_state 
         WHERE tablo_adi = $1 AND yon = $2`,
                [tableName, direction]
            );

            return result ? result.son_senkronizasyon_zamani : null;
        } catch (error) {
            logger.error(`Son senkronizasyon zamanı alınamadı (${tableName}, ${direction}):`, error);
            return null;
        }
    }

    /**
     * Senkronizasyon zamanını günceller
     * @param {string} tableName - Tablo adı
     * @param {string} direction - Yön
     * @param {number} recordCount - İşlenen kayıt sayısı
     * @param {boolean} success - Başarılı mı?
     * @param {string} errorMessage - Hata mesajı (varsa)
     */
    async updateSyncTime(tableName, direction, recordCount = 0, success = true, errorMessage = null) {
        try {
            const now = new Date();

            const existing = await pgService.queryOne(
                'SELECT id FROM sync_state WHERE tablo_adi = $1 AND yon = $2',
                [tableName, direction]
            );

            if (existing) {
                // Güncelle
                await pgService.query(
                    `UPDATE sync_state SET 
            son_senkronizasyon_zamani = $1,
            kayit_sayisi = $2,
            basarili = $3,
            hata_mesaji = $4,
            guncelleme_tarihi = $1
           WHERE tablo_adi = $5 AND yon = $6`,
                    [now, recordCount, success, errorMessage, tableName, direction]
                );
            } else {
                // Yeni ekle
                await pgService.query(
                    `INSERT INTO sync_state (
            tablo_adi, yon, son_senkronizasyon_zamani, 
            kayit_sayisi, basarili, hata_mesaji
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [tableName, direction, now, recordCount, success, errorMessage]
                );
            }

            logger.info(`Sync state güncellendi: ${tableName} (${direction}) - ${recordCount} kayıt`);
        } catch (error) {
            logger.error(`Sync state güncellenemedi (${tableName}, ${direction}):`, error);
        }
    }

    /**
     * İlk senkronizasyon mu kontrol eder
     * @param {string} tableName - Tablo adı
     * @param {string} direction - Yön
     * @returns {Promise<boolean>} İlk senkronizasyon ise true
     */
    async isFirstSync(tableName, direction) {
        const lastSync = await this.getLastSyncTime(tableName, direction);
        return lastSync === null;
    }

    /**
     * Tüm senkronizasyon durumlarını getirir
     * @returns {Promise<Array>} Senkronizasyon durumları
     */
    async getAllSyncStates() {
        try {
            return await pgService.query(
                `SELECT * FROM sync_state 
         ORDER BY tablo_adi, yon`
            );
        } catch (error) {
            logger.error('Sync state listesi alınamadı:', error);
            return [];
        }
    }

    /**
     * Belirli bir tablo için senkronizasyon durumunu sıfırlar
     * @param {string} tableName - Tablo adı
     * @param {string} direction - Yön (opsiyonel, belirtilmezse her iki yön)
     */
    async resetSyncState(tableName, direction = null) {
        try {
            if (direction) {
                await pgService.query(
                    'DELETE FROM sync_state WHERE tablo_adi = $1 AND yon = $2',
                    [tableName, direction]
                );
                logger.info(`Sync state sıfırlandı: ${tableName} (${direction})`);
            } else {
                await pgService.query(
                    'DELETE FROM sync_state WHERE tablo_adi = $1',
                    [tableName]
                );
                logger.info(`Sync state sıfırlandı: ${tableName} (tüm yönler)`);
            }
        } catch (error) {
            logger.error(`Sync state sıfırlanamadı (${tableName}):`, error);
        }
    }

    /**
     * Tüm senkronizasyon durumlarını sıfırlar (DİKKATLİ KULLANIN!)
     */
    async resetAllSyncStates() {
        try {
            await pgService.query('DELETE FROM sync_state');
            logger.warn('TÜM sync state kayıtları sıfırlandı!');
        } catch (error) {
            logger.error('Sync state sıfırlanamadı:', error);
        }
    }
}

module.exports = new SyncStateService();
