const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const stokTransformer = require('../transformers/stok.transformer');
const syncStateService = require('../services/sync-state.service');
const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

class StokProcessor {
  constructor() {
    this.tableName = 'STOKLAR';
  }

  /**
   * ERP'den Web'e stok senkronizasyonu (İnkremental)
   * @param {Date|null} lastSyncTime - Son senkronizasyon zamanı (null ise tam senkronizasyon)
   * @returns {Promise<number>} İşlenen kayıt sayısı
   */
  async syncToWeb(lastSyncTime = null) {
    try {
      const direction = 'erp_to_web';

      // Eğer lastSyncTime verilmemişse, sync_state'den al
      if (lastSyncTime === undefined || lastSyncTime === null) {
        lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
      }

      const isFirstSync = lastSyncTime === null;
      logger.info(`Stok senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

      if (!isFirstSync) {
        logger.info(`Son senkronizasyon: ${lastSyncTime.toLocaleString('tr-TR')}`);
      }

      // Değişen kayıtları getir
      const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
      logger.info(`${changedRecords.length} değişen stok bulundu`);

      let processedCount = 0;
      let errorCount = 0;

      for (const erpStok of changedRecords) {
        try {
          await this.syncSingleStokToWeb(erpStok);
          processedCount++;

          if (processedCount % 100 === 0) {
            logger.info(`  ${processedCount}/${changedRecords.length} stok işlendi...`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`Stok senkronizasyon hatası (${erpStok.sto_kod}):`, error.message);
        }
      }

      // Sync state güncelle
      await syncStateService.updateSyncTime(
        this.tableName,
        direction,
        processedCount,
        errorCount === 0,
        errorCount > 0 ? `${errorCount} hata oluştu` : null
      );

      logger.info(`Stok senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
      return processedCount;

    } catch (error) {
      logger.error('Stok senkronizasyon hatası:', error);
      await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
      throw error;
    }
  }

  /**
   * ERP'den değişen kayıtları getirir
   * @param {Date|null} lastSyncTime - Son senkronizasyon zamanı
   * @returns {Promise<Array>} Değişen kayıtlar
   */
  async getChangedRecordsFromERP(lastSyncTime) {
    let whereClause = 'WHERE sto_pasif_fl = 0';
    const params = {};

    if (lastSyncTime) {
      whereClause += ' AND sto_lastup_date > @lastSyncTime';
      params.lastSyncTime = lastSyncTime;
    }

    const query = `
      SELECT 
        sto_kod, sto_isim, sto_birim1_ad, sto_standartmaliyet,
        sto_sektor_kodu, sto_reyon_kodu, sto_ambalaj_kodu, 
        sto_kalkon_kodu, sto_yabanci_isim, sto_lastup_date
      FROM STOKLAR
      ${whereClause}
      ORDER BY sto_lastup_date
    `;

    return await mssqlService.query(query, params);
  }

  /**
   * Tek bir stok kaydını Web'e senkronize eder
   * @param {Object} erpStok - ERP stok kaydı
   */
  async syncSingleStokToWeb(erpStok) {
    // Stok verilerini transform et
    const webStok = await stokTransformer.transformFromERP(erpStok);

    // Mapping kontrolü
    const existingMapping = await pgService.queryOne(
      'SELECT web_stok_id FROM int_kodmap_stok WHERE erp_stok_kod = $1',
      [erpStok.sto_kod]
    );

    let webStokId;

    if (existingMapping) {
      // Mevcut stok - güncelle
      webStokId = existingMapping.web_stok_id;

      await pgService.query(
        `UPDATE stoklar SET 
          stok_adi = $1, birim_turu = $2, alis_fiyati = $3, 
          satis_fiyati = $4, aciklama = $5, olcu = $6, 
          raf_kodu = $7, ambalaj = $8, koliadeti = $9, 
          guncelleme_tarihi = NOW()
         WHERE id = $10`,
        [
          webStok.stok_adi, webStok.birim_turu, webStok.alis_fiyati,
          webStok.satis_fiyati, webStok.aciklama, webStok.olcu,
          webStok.raf_kodu, webStok.ambalaj, webStok.koliadeti,
          webStokId
        ]
      );
      logger.debug(`Stok güncellendi: ${erpStok.sto_kod}`);
    } else {
      // Yeni stok - ekle
      const result = await pgService.queryOne(
        `INSERT INTO stoklar (
          stok_kodu, stok_adi, birim_turu, alis_fiyati, satis_fiyati,
          aciklama, olcu, raf_kodu, ambalaj, koliadeti, aktif
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          webStok.stok_kodu, webStok.stok_adi, webStok.birim_turu,
          webStok.alis_fiyati, webStok.satis_fiyati, webStok.aciklama,
          webStok.olcu, webStok.raf_kodu, webStok.ambalaj,
          webStok.koliadeti, webStok.aktif
        ]
      );

      webStokId = result.id;

      // Mapping ekle
      await pgService.query(
        `INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod)
         VALUES ($1, $2)`,
        [webStokId, erpStok.sto_kod]
      );

      logger.debug(`Yeni stok eklendi: ${erpStok.sto_kod}`);
    }

    // Barkodları senkronize et
    await this.syncBarkodlar(erpStok.sto_kod, webStokId);
  }

  /**
   * Stok barkodlarını senkronize eder
   * @param {string} stokKod - ERP stok kodu
   * @param {string} webStokId - Web stok ID
   */
  async syncBarkodlar(stokKod, webStokId) {
    try {
      // ERP'den barkodları çek
      const erpBarkodlar = await mssqlService.query(
        'SELECT * FROM BARKOD_TANIMLARI WHERE bar_stokkodu = @stokKod',
        { stokKod }
      );

      for (const erpBarkod of erpBarkodlar) {
        const webBarkod = await stokTransformer.transformBarkodFromERP(erpBarkod);

        // Barkod boş ise atla
        if (!webBarkod.barkod || webBarkod.barkod.trim() === '') {
          continue;
        }

        // Barkod var mı kontrol et
        const existing = await pgService.queryOne(
          'SELECT id FROM urun_barkodlari WHERE barkod = $1',
          [webBarkod.barkod]
        );

        if (existing) {
          // Güncelle
          await pgService.query(
            `UPDATE urun_barkodlari SET 
              stok_id = $1, barkod_tipi = $2, aktif = $3, 
              guncelleme_tarihi = NOW()
             WHERE id = $4`,
            [webStokId, webBarkod.barkod_tipi, webBarkod.aktif, existing.id]
          );
        } else {
          // Yeni ekle
          await pgService.query(
            `INSERT INTO urun_barkodlari (stok_id, barkod, barkod_tipi, aktif)
             VALUES ($1, $2, $3, $4)`,
            [webStokId, webBarkod.barkod, webBarkod.barkod_tipi, webBarkod.aktif]
          );
        }
      }

      logger.debug(`Barkodlar senkronize edildi: ${stokKod}`);
    } catch (error) {
      logger.error('Barkod senkronizasyon hatası:', error);
      // Barkod hatası ana işlemi durdurmasın
    }
  }

  /**
   * Web'den ERP'ye stok senkronizasyonu (gelecekte eklenecek)
   * @param {Date|null} lastSyncTime - Son senkronizasyon zamanı
   * @returns {Promise<number>} İşlenen kayıt sayısı
   */
  async syncFromWeb(lastSyncTime = null) {
    // TODO: Web'den ERP'ye stok senkronizasyonu
    // Şu an için stoklar sadece ERP'den Web'e aktarılıyor
    logger.info('Web→ERP stok senkronizasyonu henüz desteklenmiyor');
    return 0;
  }

  /**
   * Eski process metodu (geriye uyumluluk için)
   */
  async process(recordData, operation) {
    if (operation === 'INSERT' || operation === 'UPDATE') {
      await this.syncSingleStokToWeb(recordData);
    }
  }
  async syncBarkodlarIncremental(lastSyncTime = null) {
    try {
      const direction = 'erp_to_web_barkod';

      if (lastSyncTime === undefined || lastSyncTime === null) {
        lastSyncTime = await syncStateService.getLastSyncTime('BARKOD_TANIMLARI', direction);
      }

      const isFirstSync = lastSyncTime === null;
      logger.info(`Barkod senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

      let whereClause = 'WHERE 1=1';
      const params = {};

      if (lastSyncTime) {
        whereClause += ' AND bar_lastup_date > @lastSyncTime';
        params.lastSyncTime = lastSyncTime;
      }

      const query = `
        SELECT bar_stokkodu, bar_kodu, bar_lastup_date
        FROM BARKOD_TANIMLARI
        ${whereClause}
        ORDER BY bar_lastup_date
      `;

      const changedRecords = await mssqlService.query(query, params);
      logger.info(`${changedRecords.length} değişen barkod bulundu`);

      let processedCount = 0;
      let errorCount = 0;

      for (const erpBarkod of changedRecords) {
        try {
          // Transformer'a eksik alanları varsayılan değerlerle gönder
          const webBarkod = await stokTransformer.transformBarkodFromERP({
            ...erpBarkod,
            bar_pasif_fl: 0, // Varsayılan aktif
            bar_tipi: 1      // Varsayılan tip
          });

          // Stok ID'sini bul
          const stokIdResult = await pgService.queryOne(
            'SELECT id FROM stoklar WHERE stok_kodu = $1',
            [webBarkod.stok_kodu]
          );

          if (stokIdResult) {
            await pgService.query(`
              INSERT INTO urun_barkodlari (stok_id, barkod, barkod_tipi, aktif, guncelleme_tarihi)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (barkod) DO UPDATE SET
                stok_id = EXCLUDED.stok_id,
                barkod_tipi = EXCLUDED.barkod_tipi,
                aktif = EXCLUDED.aktif,
                guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
            `, [
              stokIdResult.id, webBarkod.barkod, webBarkod.barkod_tipi,
              webBarkod.aktif, new Date()
            ]);
            processedCount++;
          } else {
            // Stok bulunamadıysa logla veya atla
            // logger.warn(`Barkod için stok bulunamadı: ${webBarkod.stok_kodu}`);
          }

          if (processedCount % 100 === 0) {
            logger.info(`  ${processedCount}/${changedRecords.length} barkod işlendi...`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`Barkod senkronizasyon hatası (${erpBarkod.bar_kodu}):`, error.message);
        }
      }

      await syncStateService.updateSyncTime(
        'BARKOD_TANIMLARI',
        direction,
        processedCount,
        errorCount === 0,
        errorCount > 0 ? `${errorCount} hata oluştu` : null
      );

      logger.info(`Barkod senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
      return processedCount;

    } catch (error) {
      logger.error('Barkod senkronizasyon hatası:', error);
      await syncStateService.updateSyncTime('BARKOD_TANIMLARI', 'erp_to_web_barkod', 0, false, error.message);
      throw error;
    }
  }
}

module.exports = new StokProcessor();
