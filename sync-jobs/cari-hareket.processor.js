const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class CariHareketProcessor {
    constructor() {
        this.tableName = 'CARI_HESAP_HAREKETLERI';
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Cari Hareket senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen cari hareket bulundu`);

            let processedCount = 0;
            let errorCount = 0;

            for (const erpHareket of changedRecords) {
                try {
                    await this.syncSingleHareketToWeb(erpHareket);
                    processedCount++;

                    if (processedCount % 100 === 0) {
                        logger.info(`  ${processedCount}/${changedRecords.length} hareket işlendi...`);
                    }
                } catch (error) {
                    errorCount++;
                    logger.error(`Cari Hareket senkronizasyon hatası (RECno: ${erpHareket.cha_RECno}):`, error.message);
                }
            }

            await syncStateService.updateSyncTime(
                this.tableName,
                direction,
                processedCount,
                errorCount === 0,
                errorCount > 0 ? `${errorCount} hata oluştu` : null
            );

            logger.info(`Cari Hareket senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Cari Hareket senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND cha_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        const query = `
      SELECT 
        cha_RECno, cha_tarihi, cha_belge_tarih,
        cha_evrakno_sira, cha_evrakno_seri,
        cha_kod, cha_meblag, cha_aratoplam,
        cha_aciklama, cha_cinsi, cha_evrak_tip, cha_tip, cha_normal_iade,
        cha_lastup_date
      FROM CARI_HESAP_HAREKETLERI
      ${whereClause}
      ORDER BY cha_lastup_date
    `;

        return await mssqlService.query(query, params);
    }

    async syncSingleHareketToWeb(erpHareket) {
        // Web tarafındaki tablo yapısını varsayıyoruz (kullanıcı isteğine göre)
        // cari_hesap_hareketleri: erp_recno, cari_hesap_id, tarih, belge_no, tutar, aciklama, guncelleme_tarihi

        const webHareket = {
            erp_recno: erpHareket.cha_RECno,
            cari_kodu: erpHareket.cha_kod,
            tarih: erpHareket.cha_tarihi,
            belge_no: (erpHareket.cha_evrakno_seri || '') + (erpHareket.cha_evrakno_sira || ''),
            tutar: erpHareket.cha_meblag,
            aciklama: erpHareket.cha_aciklama,
            guncelleme_tarihi: new Date()
        };

        await pgService.query(`
      INSERT INTO cari_hesap_hareketleri (
        erp_recno, cari_hesap_id, tarih, belge_no, tutar, aciklama, guncelleme_tarihi
      )
      VALUES (
        $1, 
        (SELECT id FROM cari_hesaplar WHERE cari_kodu = $2 LIMIT 1), 
        $3, $4, $5, $6, $7
      )
      ON CONFLICT (erp_recno) 
      DO UPDATE SET 
        cari_hesap_id = (SELECT id FROM cari_hesaplar WHERE cari_kodu = $2 LIMIT 1),
        tarih = EXCLUDED.tarih,
        belge_no = EXCLUDED.belge_no,
        tutar = EXCLUDED.tutar,
        aciklama = EXCLUDED.aciklama,
        guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
    `, [
            webHareket.erp_recno, webHareket.cari_kodu, webHareket.tarih,
            webHareket.belge_no, webHareket.tutar, webHareket.aciklama,
            webHareket.guncelleme_tarihi
        ]);
    }
}

module.exports = new CariHareketProcessor();
