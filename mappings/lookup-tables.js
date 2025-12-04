const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

class LookupTables {
  constructor() {
    this.cache = {
      cari: new Map(),
      stok: new Map(),
      banka: new Map(),
      kasa: new Map(),
      fiyatListe: new Map(),
      kdvPointer: new Map()
    };
    this.cacheExpiry = 5 * 60 * 1000; // 5 dakika
    this.lastCacheUpdate = null;
  }

  async refreshCache() {
    const now = Date.now();
    if (this.lastCacheUpdate && (now - this.lastCacheUpdate) < this.cacheExpiry) {
      return; // Cache hala geçerli
    }

    try {
      // Cari mapping
      const cariMaps = await pgService.query('SELECT * FROM int_kodmap_cari');
      this.cache.cari.clear();
      cariMaps.forEach(row => {
        this.cache.cari.set(row.web_cari_id, row.erp_cari_kod);
      });

      // Stok mapping
      const stokMaps = await pgService.query('SELECT * FROM int_kodmap_stok');
      this.cache.stok.clear();
      stokMaps.forEach(row => {
        this.cache.stok.set(row.web_stok_id, row.erp_stok_kod);
      });

      // Banka mapping
      const bankaMaps = await pgService.query('SELECT * FROM int_kodmap_banka');
      this.cache.banka.clear();
      bankaMaps.forEach(row => {
        this.cache.banka.set(row.web_banka_id, row.erp_banka_kod);
      });

      // Kasa mapping
      const kasaMaps = await pgService.query('SELECT * FROM int_kodmap_kasa');
      this.cache.kasa.clear();
      kasaMaps.forEach(row => {
        this.cache.kasa.set(row.web_kasa_id, row.erp_kasa_kod);
      });

      // Fiyat Liste mapping
      const fiyatMaps = await pgService.query('SELECT * FROM int_kodmap_fiyat_liste');
      this.cache.fiyatListe.clear();
      fiyatMaps.forEach(row => {
        this.cache.fiyatListe.set(row.web_fiyat_tanimi_id, row.erp_liste_no);
      });

      // KDV Pointer mapping (MS SQL'den)
      const kdvMaps = await mssqlService.query('SELECT * FROM INT_KdvPointerMap');
      this.cache.kdvPointer.clear();
      kdvMaps.forEach(row => {
        this.cache.kdvPointer.set(row.kdv_oran, row.vergi_pntr);
      });

      this.lastCacheUpdate = now;
      logger.info('Lookup cache yenilendi');
    } catch (error) {
      logger.error('Cache yenileme hatası:', error);
      throw error;
    }
  }

  async getCariKod(webCariId) {
    await this.refreshCache();
    let kod = this.cache.cari.get(webCariId);

    if (!kod) {
      // Cache'de yoksa doğrudan cari_hesaplar tablosuna bak
      try {
        const result = await pgService.query('SELECT cari_kodu FROM cari_hesaplar WHERE id = $1', [webCariId]);
        if (result.length > 0) {
          kod = result[0].cari_kodu;
          this.cache.cari.set(webCariId, kod);
        }
      } catch (err) {
        logger.error(`Cari kodu sorgulama hatası (${webCariId}):`, err);
      }
    }

    if (!kod) {
      logger.mappingError('cari', webCariId, {
        availableMappings: this.cache.cari.size,
        suggestion: 'INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod) VALUES (...)'
      });
    }
    return kod;
  }

  async getStokKod(webStokId) {
    await this.refreshCache();
    let kod = this.cache.stok.get(webStokId);

    if (!kod) {
      // Cache'de yoksa doğrudan stoklar tablosuna bak
      try {
        const result = await pgService.query('SELECT stok_kodu FROM stoklar WHERE id = $1', [webStokId]);
        if (result.length > 0) {
          kod = result[0].stok_kodu;
          this.cache.stok.set(webStokId, kod);
        }
      } catch (err) {
        logger.error(`Stok kodu sorgulama hatası (${webStokId}):`, err);
      }
    }

    if (!kod) {
      logger.mappingError('stok', webStokId, {
        availableMappings: this.cache.stok.size,
        suggestion: 'INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod) VALUES (...)'
      });
    }
    return kod;
  }

  async getBankaKod(webBankaId) {
    await this.refreshCache();
    return this.cache.banka.get(webBankaId);
  }

  async getKasaKod(webKasaId) {
    await this.refreshCache();
    return this.cache.kasa.get(webKasaId);
  }

  async getFiyatListeNo(webFiyatTanimiId) {
    await this.refreshCache();
    return this.cache.fiyatListe.get(webFiyatTanimiId);
  }

  async getKdvPointer(kdvOran) {
    await this.refreshCache();
    return this.cache.kdvPointer.get(kdvOran) || 0;
  }

  // Yeni mapping ekle
  async addCariMapping(webCariId, erpCariKod) {
    await pgService.query(
      `INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod) 
       VALUES ($1, $2) 
       ON CONFLICT (web_cari_id) DO UPDATE SET erp_cari_kod = $2, sync_date = NOW()`,
      [webCariId, erpCariKod]
    );
    this.cache.cari.set(webCariId, erpCariKod);
  }

  async addStokMapping(webStokId, erpStokKod) {
    await pgService.query(
      `INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod) 
       VALUES ($1, $2) 
       ON CONFLICT (web_stok_id) DO UPDATE SET erp_stok_kod = $2, sync_date = NOW()`,
      [webStokId, erpStokKod]
    );
    this.cache.stok.set(webStokId, erpStokKod);
  }

  async addBankaMapping(webBankaId, erpBankaKod) {
    await pgService.query(
      `INSERT INTO int_kodmap_banka (web_banka_id, erp_banka_kod) 
       VALUES ($1, $2) 
       ON CONFLICT (web_banka_id) DO UPDATE SET erp_banka_kod = $2, sync_date = NOW()`,
      [webBankaId, erpBankaKod]
    );
    this.cache.banka.set(webBankaId, erpBankaKod);
  }

  async addKasaMapping(webKasaId, erpKasaKod) {
    await pgService.query(
      `INSERT INTO int_kodmap_kasa (web_kasa_id, erp_kasa_kod) 
       VALUES ($1, $2) 
       ON CONFLICT (web_kasa_id) DO UPDATE SET erp_kasa_kod = $2, sync_date = NOW()`,
      [webKasaId, erpKasaKod]
    );
    this.cache.kasa.set(webKasaId, erpKasaKod);
  }

  async addFiyatListeMapping(webFiyatTanimiId, erpListeNo) {
    await pgService.query(
      `INSERT INTO int_kodmap_fiyat_liste (web_fiyat_tanimi_id, erp_liste_no) 
       VALUES ($1, $2) 
       ON CONFLICT (web_fiyat_tanimi_id) DO UPDATE SET erp_liste_no = $2, sync_date = NOW()`,
      [webFiyatTanimiId, erpListeNo]
    );
    this.cache.fiyatListe.set(webFiyatTanimiId, erpListeNo);
  }
}

module.exports = new LookupTables();
