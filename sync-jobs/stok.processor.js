const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const stokTransformer = require('../transformers/stok.transformer');
const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

class StokProcessor {
  async process(recordData, operation) {
    if (operation === 'INSERT' || operation === 'UPDATE') {
      await this.syncToWeb(recordData);
    }
  }

  async syncToWeb(erpStok) {
    try {
      // Stok verilerini transform et
      const webStok = await stokTransformer.transformFromERP(erpStok);

      // Mapping kontrolü
      const existingMapping = await pgService.queryOne(
        'SELECT web_stok_id FROM int_kodmap_stok WHERE erp_stok_kod = $1',
        [erpStok.sto_kod]
      );

      let webStokId;

      if (existingMapping) {
        // Güncelle
        webStokId = existingMapping.web_stok_id;
        await pgService.query(
          `UPDATE stoklar SET 
            stok_adi = $1, birim_turu = $2, alis_fiyati = $3, 
            satis_fiyati = $4, aciklama = $5, olcu = $6, 
            raf_kodu = $7, ambalaj = $8, koliadeti = $9, 
            katalog_adi = $10, guncelleme_tarihi = NOW()
           WHERE id = $11`,
          [
            webStok.stok_adi, webStok.birim_turu, webStok.alis_fiyati,
            webStok.satis_fiyati, webStok.aciklama, webStok.olcu,
            webStok.raf_kodu, webStok.ambalaj, webStok.koliadeti,
            webStok.katalog_adi, webStokId
          ]
        );
        logger.info(`Stok güncellendi: ${erpStok.sto_kod}`);
      } else {
        // Yeni ekle
        const result = await pgService.queryOne(
          `INSERT INTO stoklar (
            stok_kodu, stok_adi, birim_turu, alis_fiyati, satis_fiyati,
            aciklama, olcu, raf_kodu, ambalaj, koliadeti, katalog_adi, aktif
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id`,
          [
            webStok.stok_kodu, webStok.stok_adi, webStok.birim_turu,
            webStok.alis_fiyati, webStok.satis_fiyati, webStok.aciklama,
            webStok.olcu, webStok.raf_kodu, webStok.ambalaj,
            webStok.koliadeti, webStok.katalog_adi, webStok.aktif
          ]
        );
        
        webStokId = result.id;
        
        // Mapping ekle
        await lookupTables.addStokMapping(webStokId, erpStok.sto_kod);
        logger.info(`Yeni stok eklendi: ${erpStok.sto_kod}`);
      }

      // Barkodları senkronize et
      await this.syncBarkodlar(erpStok.sto_kod, webStokId);

    } catch (error) {
      logger.error('Stok Web senkronizasyon hatası:', error);
      throw error;
    }
  }

  async syncBarkodlar(stokKod, webStokId) {
    try {
      // ERP'den barkodları çek
      const erpBarkodlar = await mssqlService.query(
        'SELECT * FROM BARKOD_TANIMLARI WHERE bar_stokkodu = @stokKod',
        { stokKod }
      );

      for (const erpBarkod of erpBarkodlar) {
        const webBarkod = await stokTransformer.transformBarkodFromERP(erpBarkod);

        // Barkod var mı kontrol et
        const existing = await pgService.queryOne(
          'SELECT id FROM barkod_tanimlari WHERE barkod = $1',
          [webBarkod.barkod]
        );

        if (existing) {
          // Güncelle
          await pgService.query(
            `UPDATE barkod_tanimlari SET 
              stok_id = $1, barkod_tipi = $2, aktif = $3, 
              guncelleme_tarihi = NOW()
             WHERE id = $4`,
            [webStokId, webBarkod.barkod_tipi, webBarkod.aktif, existing.id]
          );
        } else {
          // Yeni ekle
          await pgService.query(
            `INSERT INTO barkod_tanimlari (stok_id, barkod, barkod_tipi, aktif)
             VALUES ($1, $2, $3, $4)`,
            [webStokId, webBarkod.barkod, webBarkod.barkod_tipi, webBarkod.aktif]
          );
        }
      }

      logger.info(`Barkodlar senkronize edildi: ${stokKod}`);
    } catch (error) {
      logger.error('Barkod senkronizasyon hatası:', error);
      // Barkod hatası ana işlemi durdurmasın
    }
  }
}

module.exports = new StokProcessor();
