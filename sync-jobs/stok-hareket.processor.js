const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class StokHareketProcessor {
    constructor() {
        this.tableName = 'STOK_HAREKETLERI';
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Stok Hareket senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen stok hareket bulundu`);

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
                    logger.error(`Stok Hareket senkronizasyon hatası (RECno: ${erpHareket.sth_RECno}):`, error.message);
                }
            }

            await syncStateService.updateSyncTime(
                this.tableName,
                direction,
                processedCount,
                errorCount === 0,
                errorCount > 0 ? `${errorCount} hata oluştu` : null
            );

            logger.info(`Stok Hareket senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Stok Hareket senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND sth_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        const query = `
      SELECT 
        sth_RECno, sth_tarih, sth_belge_tarih,
        sth_evrakno_sira, sth_evrakno_seri,
        sth_stok_kod, sth_cari_kodu,
        sth_miktar, sth_tutar, sth_vergi,
        sth_tip, sth_cins, sth_normal_iade, sth_evraktip,
        sth_lastup_date
      FROM STOK_HAREKETLERI
      ${whereClause}
      ORDER BY sth_lastup_date
    `;

        return await mssqlService.query(query, params);
    }

    async syncSingleHareketToWeb(erpHareket) {
        // Web tarafındaki tablo yapısını varsayıyoruz
        // stok_hareketleri: erp_recno, stok_id, cari_hesap_id, tarih, belge_no, miktar, tutar, guncelleme_tarihi

        const webHareket = {
            erp_recno: erpHareket.sth_RECno,
            stok_kodu: erpHareket.sth_stok_kod,
            cari_kodu: erpHareket.sth_cari_kodu,
            tarih: erpHareket.sth_tarih,
            belge_no: (erpHareket.sth_evrakno_seri || '') + (erpHareket.sth_evrakno_sira || ''),
            miktar: erpHareket.sth_miktar,
            tutar: erpHareket.sth_tutar,
            guncelleme_tarihi: new Date()
        };

        await pgService.query(`
      INSERT INTO stok_hareketleri (
        erp_recno, stok_id, cari_hesap_id, tarih, belge_no, miktar, tutar, guncelleme_tarihi
      )
      VALUES (
        $1, 
        (SELECT id FROM stoklar WHERE stok_kodu = $2 LIMIT 1),
        (SELECT id FROM cari_hesaplar WHERE cari_kodu = $3 LIMIT 1),
        $4, $5, $6, $7, $8
      )
      ON CONFLICT (erp_recno) 
      DO UPDATE SET 
        stok_id = (SELECT id FROM stoklar WHERE stok_kodu = $2 LIMIT 1),
        cari_hesap_id = (SELECT id FROM cari_hesaplar WHERE cari_kodu = $3 LIMIT 1),
        tarih = EXCLUDED.tarih,
        belge_no = EXCLUDED.belge_no,
        miktar = EXCLUDED.miktar,
        tutar = EXCLUDED.tutar,
        guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
    `, [
            webHareket.erp_recno, webHareket.stok_kodu, webHareket.cari_kodu,
            webHareket.tarih, webHareket.belge_no, webHareket.miktar,
            webHareket.tutar, webHareket.guncelleme_tarihi
        ]);
    }
}

module.exports = new StokHareketProcessor();
