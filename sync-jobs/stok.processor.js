const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const stokTransformer = require('../transformers/stok.transformer');
const syncStateService = require('../services/sync-state.service');
const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

class StokProcessor {
  constructor() {
    this.tableName = 'STOKLAR';
    this.categoryMap = new Map(); // erp_id -> web_id
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

      // Kategorileri belleğe yükle
      await this.loadCategories();
      logger.info(`${this.categoryMap.size} kategori eşleşmesi yüklendi.`);

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
   * Kategorileri veritabanından çeker ve map'e yükler
   */
  async loadCategories() {
    try {
      const categories = await pgService.query('SELECT id, erp_id FROM kategoriler WHERE erp_id IS NOT NULL');
      this.categoryMap.clear();
      for (const cat of categories) {
        const erpId = cat.erp_id ? cat.erp_id.trim() : null;
        if (erpId) {
          this.categoryMap.set(erpId, cat.id);
        }
      }
    } catch (error) {
      logger.error('Kategori yükleme hatası:', error);
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
        sto_kalkon_kodu, sto_yabanci_isim, sto_lastup_date,
        sto_altgrup_kod, sto_anagrup_kod, sto_create_date
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

    // Kategori ID belirle
    let kategoriId = null;
    const altGrupKod = erpStok.sto_altgrup_kod ? erpStok.sto_altgrup_kod.trim() : null;
    const anaGrupKod = erpStok.sto_anagrup_kod ? erpStok.sto_anagrup_kod.trim() : null;

    if (altGrupKod && this.categoryMap.has(altGrupKod)) {
      kategoriId = this.categoryMap.get(altGrupKod);
    } else if (anaGrupKod && this.categoryMap.has(anaGrupKod)) {
      kategoriId = this.categoryMap.get(anaGrupKod);
    }

    let webStokId = null;
    let isNew = false;

    // 1. Mapping kontrolü (Stok tablosuyla join yaparak)
    const existingMapping = await pgService.queryOne(
      `SELECT m.web_stok_id 
       FROM int_kodmap_stok m
       JOIN stoklar s ON m.web_stok_id = s.id
       WHERE m.erp_stok_kod = $1`,
      [erpStok.sto_kod]
    );

    if (existingMapping) {
      webStokId = existingMapping.web_stok_id;
    } else {
      // 2. Stok kodu kontrolü (Mapping yoksa veya geçersizse)
      const existingStok = await pgService.queryOne(
        'SELECT id FROM stoklar WHERE stok_kodu = $1',
        [webStok.stok_kodu]
      );

      if (existingStok) {
        webStokId = existingStok.id;

        // Eski mapping varsa temizle (temizlik için)
        await pgService.query('DELETE FROM int_kodmap_stok WHERE erp_stok_kod = $1', [erpStok.sto_kod]);

        // Yeni mapping ekle
        await pgService.query(
          `INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod) VALUES ($1, $2)`,
          [webStokId, erpStok.sto_kod]
        );
      } else {
        isNew = true;
      }
    }

    if (!isNew) {
      // Mevcut stok - güncelle
      await pgService.query(
        `UPDATE stoklar SET 
          stok_adi = $1, birim_turu = $2, alis_fiyati = $3, 
          satis_fiyati = $4, aciklama = $5, olcu = $6, 
          raf_kodu = $7, ambalaj = $8, koliadeti = $9, 
          kategori_id = $10, olusturma_tarihi = $11, guncelleme_tarihi = NOW()
         WHERE id = $12`,
        [
          webStok.stok_adi, webStok.birim_turu, webStok.alis_fiyati,
          webStok.satis_fiyati, webStok.aciklama, webStok.olcu,
          webStok.raf_kodu, webStok.ambalaj, webStok.koliadeti,
          kategoriId, webStok.olusturma_tarihi, webStokId
        ]
      );
      logger.debug(`Stok güncellendi: ${erpStok.sto_kod}`);
    } else {
      // Yeni stok - ekle
      // Emin olmak için mapping'i tekrar temizle
      await pgService.query('DELETE FROM int_kodmap_stok WHERE erp_stok_kod = $1', [erpStok.sto_kod]);

      const result = await pgService.queryOne(
        `INSERT INTO stoklar (
          stok_kodu, stok_adi, birim_turu, alis_fiyati, satis_fiyati,
          aciklama, olcu, raf_kodu, ambalaj, koliadeti, aktif, kategori_id, olusturma_tarihi
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id`,
        [
          webStok.stok_kodu, webStok.stok_adi, webStok.birim_turu,
          webStok.alis_fiyati, webStok.satis_fiyati, webStok.aciklama,
          webStok.olcu, webStok.raf_kodu, webStok.ambalaj,
          webStok.koliadeti, webStok.aktif, kategoriId, webStok.olusturma_tarihi
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
   * Tek bir stok kaydını ERP'ye senkronize eder (Web -> ERP)
   * @param {Object} webStok - Web stok kaydı
   */
  async syncToERP(webStok) {
    try {
      logger.info(`Stok ERP'ye senkronize ediliyor: ${webStok.stok_kodu}`);

      // 1. Stok koduna göre ERP'deki kaydı bul
      const erpStokResult = await mssqlService.query(
        `SELECT sto_RECno FROM STOKLAR WHERE sto_kod = @stokKod`,
        { stokKod: webStok.stok_kodu }
      );

      let stoRecno;
      const updateDate = new Date().toISOString().replace('T', ' ').substring(0, 23);

      if (erpStokResult.length === 0) {
        // YENİ STOK - INSERT işlemi
        logger.info(`Yeni stok ERP'ye ekleniyor: ${webStok.stok_kodu}`);

        stoRecno = await this.insertStokToERP(webStok, updateDate);
        logger.info(`✓ Yeni stok ERP'ye eklendi: ${webStok.stok_kodu} (RECno: ${stoRecno})`);
      } else {
        // MEVCUT STOK - UPDATE işlemi
        stoRecno = erpStokResult[0].sto_RECno;

        await mssqlService.query(
          `UPDATE STOKLAR SET 
          sto_lastup_date = @lastupDate,
          sto_isim = @stokAdi,
          sto_yabanci_isim = @yabanciIsim,
          sto_ambalaj_kodu = @ambalaj,
          sto_reyon_kodu = @rafKodu,
          sto_sektor_kodu = @olcu,
          sto_birim1_ad = @birimTuru
        WHERE sto_RECno = @stoRecno`,
          {
            lastupDate: updateDate,
            stokAdi: webStok.stok_adi || '',
            yabanciIsim: webStok.aciklama || webStok.stok_adi || '',
            ambalaj: webStok.ambalaj || '',
            rafKodu: webStok.raf_kodu || '',
            olcu: webStok.olcu || '',
            birimTuru: webStok.birim_turu || 'Adet',
            stoRecno: stoRecno
          }
        );

        logger.info(`✓ Stok bilgileri ERP'ye güncellendi: ${webStok.stok_kodu} (RECno: ${stoRecno})`);
      }

      // Fiyat işlemi else'den sonra da çalışsın (yeni ve güncelleme için)
      if (webStok.satis_fiyati !== undefined && webStok.satis_fiyati !== null) {
        const fiyatResult = await mssqlService.query(
          `SELECT sfiyat_RECno FROM STOK_SATIS_FIYAT_LISTELERI 
           WHERE sfiyat_stokkod = @stokKod AND sfiyat_listesirano = 1`,
          { stokKod: webStok.stok_kodu }
        );

        if (fiyatResult.length > 0) {
          await mssqlService.query(
            `UPDATE STOK_SATIS_FIYAT_LISTELERI SET 
              sfiyat_lastup_date = @lastupDate,
              sfiyat_fiyati = @fiyat
            WHERE sfiyat_RECno = @sfiyatRecno`,
            {
              lastupDate: updateDate,
              fiyat: parseFloat(webStok.satis_fiyati) || 0,
              sfiyatRecno: fiyatResult[0].sfiyat_RECno
            }
          );
          logger.info(`✓ Stok fiyatı ERP'ye güncellendi: ${webStok.stok_kodu} -> ${webStok.satis_fiyati}`);
        } else {
          // Yeni fiyat kaydı oluştur - SQL trace'den tam INSERT sorgusu
          const insertFiyatResult = await mssqlService.query(`
            INSERT INTO STOK_SATIS_FIYAT_LISTELERI (
              sfiyat_RECid_DBCno, sfiyat_RECid_RECno, sfiyat_SpecRECno, sfiyat_iptal,
              sfiyat_fileid, sfiyat_hidden, sfiyat_kilitli, sfiyat_degisti, sfiyat_checksum,
              sfiyat_create_user, sfiyat_create_date, sfiyat_lastup_user, sfiyat_lastup_date,
              sfiyat_special1, sfiyat_special2, sfiyat_special3,
              sfiyat_stokkod, sfiyat_listesirano, sfiyat_deposirano, sfiyat_odemeplan,
              sfiyat_fiyati, sfiyat_doviz, sfiyat_iskontokod, sfiyat_deg_nedeni,
              sfiyat_primyuzdesi, sfiyat_kampanyakod
            ) VALUES (
              0, 0, 0, 0,
              228, 0, 0, 0, 0,
              1, @createDate, 1, @lastupDate,
              N'', N'', N'',
              @stokKod, 1, 0, 0,
              @fiyat, 0, N'', 0,
              0, N''
            );
            SELECT SCOPE_IDENTITY() AS sfiyat_RECno;
          `, {
            createDate: updateDate,
            lastupDate: updateDate,
            stokKod: webStok.stok_kodu,
            fiyat: parseFloat(webStok.satis_fiyati) || 0
          });

          // RECid_RECno güncelle
          if (insertFiyatResult && insertFiyatResult[0]) {
            const sfiyatRecno = insertFiyatResult[0].sfiyat_RECno;
            await mssqlService.query(
              `UPDATE STOK_SATIS_FIYAT_LISTELERI SET sfiyat_RECid_RECno = @recno WHERE sfiyat_RECno = @recno`,
              { recno: sfiyatRecno }
            );
          }

          logger.info(`✓ Stok fiyatı ERP'ye eklendi: ${webStok.stok_kodu} -> ${webStok.satis_fiyati}`);
        }
      }

      return true;

    } catch (error) {
      logger.error(`Stok ERP senkronizasyon hatası (${webStok.stok_kodu}):`, error);
      throw error;
    }
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

  /**
   * Yeni stok kaydını ERP'ye ekler (INSERT)
   * @param {Object} webStok - Web stok kaydı
   * @param {string} updateDate - Tarih
   * @returns {Promise<number>} - Eklenen kayıt RECno
   */
  async insertStokToERP(webStok, updateDate) {
    const insertResult = await mssqlService.query(`
      INSERT INTO STOKLAR (
        sto_RECid_DBCno, sto_RECid_RECno, sto_SpecRECno, sto_iptal, sto_fileid,
        sto_hidden, sto_kilitli, sto_degisti, sto_checksum,
        sto_create_user, sto_create_date, sto_lastup_user, sto_lastup_date,
        sto_special1, sto_special2, sto_special3,
        sto_kod, sto_isim, sto_kisa_ismi, sto_yabanci_isim,
        sto_sat_cari_kod, sto_cins, sto_doviz_cinsi, sto_detay_takip,
        sto_birim1_ad, sto_birim1_katsayi, sto_birim1_agirlik,
        sto_birim1_en, sto_birim1_boy, sto_birim1_yukseklik, sto_birim1_dara,
        sto_birim2_ad, sto_birim2_katsayi, sto_birim2_agirlik,
        sto_birim2_en, sto_birim2_boy, sto_birim2_yukseklik, sto_birim2_dara,
        sto_birim3_ad, sto_birim3_katsayi, sto_birim3_agirlik,
        sto_birim3_en, sto_birim3_boy, sto_birim3_yukseklik, sto_birim3_dara,
        sto_birim4_ad, sto_birim4_katsayi, sto_birim4_agirlik,
        sto_birim4_en, sto_birim4_boy, sto_birim4_yukseklik, sto_birim4_dara,
        sto_muh_kod, sto_muh_Iade_kod, sto_muh_sat_muh_kod, sto_muh_satIadmuhkod,
        sto_muh_sat_isk_kod, sto_muh_aIiskmuhkod, sto_muh_satmalmuhkod,
        sto_yurtdisi_satmuhk, sto_ilavemasmuhkod, sto_yatirimtesmuhkod,
        sto_depsatmuhkod, sto_depsatmalmuhkod, sto_bagortsatmuhkod,
        sto_bagortsatIadmuhkod, sto_bagortsatIskmuhkod, sto_satfiyfarkmuhkod,
        sto_yurtdisisatmalmuhkod, sto_bagortsatmalmuhkod, sto_sifirbedsatmalmuhkod,
        sto_karorani, sto_min_stok, sto_siparis_stok, sto_max_stok,
        sto_perakende_vergi, sto_toptan_vergi,
        sto_satis_dursun, sto_siparis_dursun, sto_malkabul_dursun,
        sto_iskon_yapilamaz, sto_tasfiyede,
        sto_sektor_kodu, sto_reyon_kodu, sto_ambalaj_kodu,
        sto_webe_gonderilecek_fl
      ) VALUES (
        0, 0, 0, 0, 13,
        0, 0, 0, 0,
        1, @createDate, 1, @lastupDate,
        N'', N'', N'',
        @stokKod, @stokAdi, N'', @yabanciIsim,
        N'', 0, 0, 0,
        @birimTuru, 1.0, 0,
        0, 0, 0, 0,
        N'', 0, 0,
        0, 0, 0, 0,
        N'', 0, 0,
        0, 0, 0, 0,
        N'', 0, 0,
        0, 0, 0, 0,
        N'153', N'153', N'600', N'610',
        N'611', N'153', N'621',
        N'601', N'153', N'258',
        N'600', N'621', N'600',
        N'610', N'611', N'600',
        N'621', N'621', N'760',
        0, 0, 0, 0,
        4, 4,
        0, 0, 0,
        0, 0,
        @olcu, @rafKodu, @ambalaj,
        0
      );
      SELECT SCOPE_IDENTITY() AS sto_RECno;
    `, {
      createDate: updateDate,
      lastupDate: updateDate,
      stokKod: webStok.stok_kodu,
      stokAdi: webStok.stok_adi || webStok.stok_kodu,
      yabanciIsim: webStok.aciklama || webStok.stok_adi || '',
      birimTuru: webStok.birim_turu || 'Adet',
      olcu: webStok.olcu || '',
      rafKodu: webStok.raf_kodu || '',
      ambalaj: webStok.ambalaj || ''
    });

    const stoRecno = insertResult[0].sto_RECno;

    // RECid_RECno güncelle
    await mssqlService.query(
      `UPDATE STOKLAR SET sto_RECid_RECno = @recno WHERE sto_RECno = @recno`,
      { recno: stoRecno }
    );

    return stoRecno;
  }
}

module.exports = new StokProcessor();

