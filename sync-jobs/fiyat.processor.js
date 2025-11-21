const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const stokTransformer = require('../transformers/stok.transformer');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class FiyatProcessor {
  constructor() {
    this.tableName = 'STOK_SATIS_FIYAT_LISTELERI';
  }

  /**
   * ERP'den Web'e fiyat senkronizasyonu (İnkremental)
   * @param {Date|null} lastSyncTime - Son senkronizasyon zamanı
   * @returns {Promise<number>} İşlenen kayıt sayısı
   */
  async syncToWeb(lastSyncTime = null) {
    try {
      const direction = 'erp_to_web';

      // Eğer lastSyncTime verilmemişse, sync_state'den al
      if (lastSyncTime === undefined) {
        lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
      }

      const isFirstSync = lastSyncTime === null;
      logger.info(`Fiyat senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

      // Değişen kayıtları getir
      const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
      logger.info(`${changedRecords.length} değişen fiyat bulundu`);

      let processedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const erpFiyat of changedRecords) {
        try {
          const result = await this.syncSingleFiyatToWeb(erpFiyat);
          if (result) {
            processedCount++;
          } else {
            skippedCount++;
          }

          if ((processedCount + skippedCount) % 100 === 0) {
            logger.info(`  ${processedCount + skippedCount}/${changedRecords.length} fiyat işlendi...`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`Fiyat senkronizasyon hatası (${erpFiyat.sfiyat_stokkod}):`, error.message);
        }
      }

      // Sync state güncelle
      await syncStateService.updateSyncTime(
        this.tableName,
        direction,
        processedCount,
        errorCount === 0,
        errorCount > 0 ? `${errorCount} hata, ${skippedCount} atlandı` : null
      );

      logger.info(`Fiyat senkronizasyonu tamamlandı: ${processedCount} başarılı, ${skippedCount} atlandı, ${errorCount} hata`);
      return processedCount;

    } catch (error) {
      logger.error('Fiyat senkronizasyon hatası:', error);
      await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
      throw error;
    }
  }

  /**
   * ERP'den değişen fiyat kayıtlarını getirir
   * @param {Date|null} lastSyncTime - Son senkronizasyon zamanı
   * @returns {Promise<Array>} Değişen kayıtlar
   */
  async getChangedRecordsFromERP(lastSyncTime) {
    let whereClause = 'WHERE sfiyat_fiyati > 0';
    const params = {};

    if (lastSyncTime) {
      whereClause += ' AND sfiyat_lastup_date > @lastSyncTime';
      params.lastSyncTime = lastSyncTime;
    }

    const query = `
      SELECT 
        sfiyat_stokkod, sfiyat_listesirano, sfiyat_fiyati,
        sfiyat_lastup_date
      FROM STOK_SATIS_FIYAT_LISTELERI
      ${whereClause}
      ORDER BY sfiyat_lastup_date
    `;

    return await mssqlService.query(query, params);
  }

  /**
   * Tek bir fiyat kaydını Web'e senkronize eder
   * @param {Object} erpFiyat - ERP fiyat kaydı
   * @returns {Promise<boolean>} Başarılı ise true
   */
  async syncSingleFiyatToWeb(erpFiyat) {
    // Stok mapping bul
    const stokMapping = await pgService.queryOne(
      'SELECT web_stok_id FROM int_kodmap_stok WHERE erp_stok_kod = $1',
      [erpFiyat.sfiyat_stokkod]
    );

    if (!stokMapping) {
      logger.warn(`Stok mapping bulunamadı: ${erpFiyat.sfiyat_stokkod}`);
      return false;
    }

    // Fiyat liste mapping bul
    const fiyatListeMapping = await pgService.queryOne(
      'SELECT web_fiyat_tanimi_id FROM int_kodmap_fiyat_liste WHERE erp_liste_no = $1',
      [erpFiyat.sfiyat_listesirano]
    );

    if (!fiyatListeMapping) {
      logger.warn(`Fiyat liste mapping bulunamadı: ${erpFiyat.sfiyat_listesirano}`);
      return false;
    }

    // Fiyat verilerini transform et
    const webFiyat = await stokTransformer.transformFiyatFromERP(erpFiyat);

    // Mevcut fiyat var mı kontrol et
    const existing = await pgService.queryOne(
      `SELECT id FROM urun_fiyat_listeleri 
       WHERE stok_id = $1 AND fiyat_tanimi_id = $2`,
      [stokMapping.web_stok_id, fiyatListeMapping.web_fiyat_tanimi_id]
    );

    if (existing) {
      // Güncelle
      await pgService.query(
        `UPDATE urun_fiyat_listeleri SET 
          fiyat = $1, baslangic_tarihi = $2, bitis_tarihi = $3,
          guncelleme_tarihi = NOW()
         WHERE id = $4`,
        [
          webFiyat.fiyat,
          webFiyat.baslangic_tarihi,
          webFiyat.bitis_tarihi,
          existing.id
        ]
      );
      logger.debug(`Fiyat güncellendi: ${erpFiyat.sfiyat_stokkod} - Liste: ${erpFiyat.sfiyat_listesirano}`);
    } else {
      // Yeni ekle
      await pgService.query(
        `INSERT INTO urun_fiyat_listeleri (
          stok_id, fiyat_tanimi_id, fiyat, baslangic_tarihi, bitis_tarihi
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          stokMapping.web_stok_id,
          fiyatListeMapping.web_fiyat_tanimi_id,
          webFiyat.fiyat,
          webFiyat.baslangic_tarihi,
          webFiyat.bitis_tarihi
        ]
      );
      logger.debug(`Yeni fiyat eklendi: ${erpFiyat.sfiyat_stokkod} - Liste: ${erpFiyat.sfiyat_listesirano}`);
    }

    return true;
  }

  /**
   * Eski process metodu (geriye uyumluluk için)
   */
  async process(recordData, operation) {
    if (operation === 'INSERT' || operation === 'UPDATE') {
      await this.syncSingleFiyatToWeb(recordData);
    }
  }
}

module.exports = new FiyatProcessor();
