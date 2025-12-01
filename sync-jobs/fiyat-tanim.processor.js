const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class FiyatTanimProcessor {
    constructor() {
        this.tableName = 'STOK_SATIS_FIYAT_LISTE_TANIMLARI';
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Fiyat Tanım senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen fiyat tanımı bulundu`);

            let processedCount = 0;
            let errorCount = 0;

            for (const erpFiyatTanim of changedRecords) {
                try {
                    await this.syncSingleFiyatTanimToWeb(erpFiyatTanim);
                    processedCount++;
                } catch (error) {
                    errorCount++;
                    logger.error(`Fiyat Tanım senkronizasyon hatası (Sıra No: ${erpFiyatTanim.sfl_sirano}):`, error.message);
                }
            }

            await syncStateService.updateSyncTime(
                this.tableName,
                direction,
                processedCount,
                errorCount === 0,
                errorCount > 0 ? `${errorCount} hata oluştu` : null
            );

            logger.info(`Fiyat Tanım senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Fiyat Tanım senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND sfl_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        const query = `
            SELECT 
                sfl_sirano,
                sfl_aciklama,
                sfl_fiyatformul,
                sfl_create_date,
                sfl_lastup_date
            FROM STOK_SATIS_FIYAT_LISTE_TANIMLARI
            ${whereClause}
            ORDER BY sfl_lastup_date
        `;

        return await mssqlService.query(query, params);
    }

    async syncSingleFiyatTanimToWeb(erpFiyatTanim) {
        const webFiyatTanim = {
            sira_no: erpFiyatTanim.sfl_sirano,
            fiyat_adi: erpFiyatTanim.sfl_aciklama,
            formul: erpFiyatTanim.sfl_fiyatformul,
            olusturma_tarihi: erpFiyatTanim.sfl_create_date || new Date(),
            guncelleme_tarihi: erpFiyatTanim.sfl_lastup_date || new Date()
        };

        // sira_no üzerinden upsert yapıyoruz
        const existingFiyatTanim = await pgService.queryOne('SELECT id FROM fiyat_tanimlari WHERE sira_no = $1', [webFiyatTanim.sira_no]);

        if (existingFiyatTanim) {
            await pgService.query(`
                UPDATE fiyat_tanimlari SET
                    fiyat_adi = $1,
                    formul = $2,
                    olusturma_tarihi = $3,
                    guncelleme_tarihi = $4
                WHERE id = $5
            `, [webFiyatTanim.fiyat_adi, webFiyatTanim.formul, webFiyatTanim.olusturma_tarihi, webFiyatTanim.guncelleme_tarihi, existingFiyatTanim.id]);
        } else {
            await pgService.query(`
                INSERT INTO fiyat_tanimlari (sira_no, fiyat_adi, formul, olusturma_tarihi, guncelleme_tarihi, aktif)
                VALUES ($1, $2, $3, $4, $5, true)
            `, [webFiyatTanim.sira_no, webFiyatTanim.fiyat_adi, webFiyatTanim.formul, webFiyatTanim.olusturma_tarihi, webFiyatTanim.guncelleme_tarihi]);
        }
    }
}

module.exports = new FiyatTanimProcessor();
