const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class KasaProcessor {
    constructor() {
        this.tableName = 'KASALAR';
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Kasa senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen kasa bulundu`);

            let processedCount = 0;
            let errorCount = 0;

            for (const erpKasa of changedRecords) {
                try {
                    await this.syncSingleKasaToWeb(erpKasa);
                    processedCount++;
                } catch (error) {
                    errorCount++;
                    logger.error(`Kasa senkronizasyon hatası (Kod: ${erpKasa.kas_kod}):`, error.message);
                }
            }

            await syncStateService.updateSyncTime(
                this.tableName,
                direction,
                processedCount,
                errorCount === 0,
                errorCount > 0 ? `${errorCount} hata oluştu` : null
            );

            logger.info(`Kasa senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Kasa senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND kas_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        const query = `
            SELECT 
                kas_kod,
                kas_isim,
                kas_create_date,
                kas_lastup_date
            FROM KASALAR
            ${whereClause}
            ORDER BY kas_lastup_date
        `;

        return await mssqlService.query(query, params);
    }

    async syncSingleKasaToWeb(erpKasa) {
        const webKasa = {
            kasa_kodu: erpKasa.kas_kod,
            kasa_adi: erpKasa.kas_isim,
            kasa_tipi: 'nakit', // Varsayılan değer
            olusturma_tarihi: erpKasa.kas_create_date || new Date(),
            guncelleme_tarihi: erpKasa.kas_lastup_date || new Date()
        };

        // Kasa kodu üzerinden upsert yapıyoruz.
        const existingKasa = await pgService.queryOne('SELECT id FROM kasalar WHERE kasa_kodu = $1', [webKasa.kasa_kodu]);

        if (existingKasa) {
            await pgService.query(`
                UPDATE kasalar SET
                    kasa_adi = $1,
                    kasa_tipi = $2,
                    olusturma_tarihi = $3,
                    guncelleme_tarihi = $4
                WHERE id = $5
            `, [webKasa.kasa_adi, webKasa.kasa_tipi, webKasa.olusturma_tarihi, webKasa.guncelleme_tarihi, existingKasa.id]);
        } else {
            await pgService.query(`
                INSERT INTO kasalar (kasa_kodu, kasa_adi, kasa_tipi, olusturma_tarihi, guncelleme_tarihi, aktif)
                VALUES ($1, $2, $3, $4, $5, true)
            `, [webKasa.kasa_kodu, webKasa.kasa_adi, webKasa.kasa_tipi, webKasa.olusturma_tarihi, webKasa.guncelleme_tarihi]);
        }
    }
}

module.exports = new KasaProcessor();
