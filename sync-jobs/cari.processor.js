const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class CariProcessor {
    constructor() {
        this.tableName = 'CARI_HESAPLAR';
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Cari senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen cari bulundu`);

            let processedCount = 0;
            let errorCount = 0;

            for (const erpCari of changedRecords) {
                try {
                    await this.syncSingleCariToWeb(erpCari);
                    processedCount++;

                    if (processedCount % 100 === 0) {
                        logger.info(`  ${processedCount}/${changedRecords.length} cari işlendi...`);
                    }
                } catch (error) {
                    errorCount++;
                    logger.error(`Cari senkronizasyon hatası (${erpCari.cari_kod}):`, error.message);
                }
            }

            await syncStateService.updateSyncTime(
                this.tableName,
                direction,
                processedCount,
                errorCount === 0,
                errorCount > 0 ? `${errorCount} hata oluştu` : null
            );

            logger.info(`Cari senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Cari senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1'; // Aktiflik kontrolü gerekirse eklenir (örn. cari_locked=0)
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND cari_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        // Adres bilgisi için LEFT JOIN eklenebilir ama şimdilik basit tutalım
        const query = `
      SELECT 
        cari_kod, cari_unvan1, cari_unvan2, 
        cari_CepTel, cari_EMail, 
        cari_vdaire_adi, cari_vdaire_no,
        cari_lastup_date
      FROM CARI_HESAPLAR
      ${whereClause}
      ORDER BY cari_lastup_date
    `;

        return await mssqlService.query(query, params);
    }

    async syncSingleCariToWeb(erpCari) {
        const webCari = {
            cari_kodu: erpCari.cari_kod,
            cari_adi: (erpCari.cari_unvan1 + ' ' + (erpCari.cari_unvan2 || '')).trim(),
            telefon: erpCari.cari_CepTel,
            eposta: erpCari.cari_EMail,
            vergi_dairesi: erpCari.cari_vdaire_adi,
            vergi_no: erpCari.cari_vdaire_no,
            guncelleme_tarihi: new Date()
        };

        // Upsert
        await pgService.query(`
      INSERT INTO cari_hesaplar (
        cari_kodu, cari_adi, telefon, eposta, vergi_dairesi, vergi_no, guncelleme_tarihi
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (cari_kodu) 
      DO UPDATE SET 
        cari_adi = EXCLUDED.cari_adi,
        telefon = EXCLUDED.telefon,
        eposta = EXCLUDED.eposta,
        vergi_dairesi = EXCLUDED.vergi_dairesi,
        vergi_no = EXCLUDED.vergi_no,
        guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
    `, [
            webCari.cari_kodu, webCari.cari_adi, webCari.telefon, webCari.eposta,
            webCari.vergi_dairesi, webCari.vergi_no, webCari.guncelleme_tarihi
        ]);
    }
}

module.exports = new CariProcessor();
