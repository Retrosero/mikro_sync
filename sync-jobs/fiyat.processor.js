const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const stokTransformer = require('../transformers/stok.transformer');
const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

class FiyatProcessor {
  async process(recordData, operation) {
    if (operation === 'INSERT' || operation === 'UPDATE') {
      await this.syncToWeb(recordData);
    }
  }

  async syncToWeb(erpFiyat) {
    try {
      // Stok mapping bul
      const stokMapping = await pgService.queryOne(
        'SELECT web_stok_id FROM int_kodmap_stok WHERE erp_stok_kod = $1',
        [erpFiyat.sfiyat_stokkod]
      );

      if (!stokMapping) {
        logger.warn(`Stok mapping bulunamadı: ${erpFiyat.sfiyat_stokkod}`);
        return;
      }

      // Fiyat liste mapping bul
      const fiyatListeMapping = await pgService.queryOne(
        'SELECT web_fiyat_tanimi_id FROM int_kodmap_fiyat_liste WHERE erp_liste_no = $1',
        [erpFiyat.sfiyat_listesirano]
      );

      if (!fiyatListeMapping) {
        logger.warn(`Fiyat liste mapping bulunamadı: ${erpFiyat.sfiyat_listesirano}`);
        return;
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
        logger.info(`Fiyat güncellendi: ${erpFiyat.sfiyat_stokkod} - Liste: ${erpFiyat.sfiyat_listesirano}`);
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
        logger.info(`Yeni fiyat eklendi: ${erpFiyat.sfiyat_stokkod} - Liste: ${erpFiyat.sfiyat_listesirano}`);
      }

    } catch (error) {
      logger.error('Fiyat Web senkronizasyon hatası:', error);
      throw error;
    }
  }
}

module.exports = new FiyatProcessor();
