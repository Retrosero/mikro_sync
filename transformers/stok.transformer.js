const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

class StokTransformer {
  // ERP → Web: Stok Kartı
  async transformFromERP(erpStok) {
    try {
      // koliadeti'yi integer'a çevir, başarısız olursa 0 yap
      let koliadeti = 0;
      if (erpStok.sto_kalkon_kodu) {
        const parsed = parseInt(erpStok.sto_kalkon_kodu);
        koliadeti = isNaN(parsed) ? 0 : parsed;
      }

      return {
        stok_kodu: erpStok.sto_kod,
        stok_adi: erpStok.sto_isim,
        birim_turu: erpStok.sto_birim1_ad || 'Adet',
        alis_fiyati: erpStok.sto_standartmaliyet || 0,
        satis_fiyati: 0, // Fiyat STOK_SATIS_FIYAT_LISTELERI tablosundan gelecek
        aciklama: '', // ERP'de bu alan yok
        olcu: erpStok.sto_sektor_kodu || '',
        raf_kodu: erpStok.sto_reyon_kodu || '',
        ambalaj: erpStok.sto_ambalaj_kodu || '',
        koliadeti: koliadeti,
        katalog_adi: erpStok.sto_yabanci_isim || '',
        aktif: true,
        olusturma_tarihi: new Date(),
        guncelleme_tarihi: new Date()
      };
    } catch (error) {
      logger.error('Stok transform hatası:', error);
      throw error;
    }
  }

  // ERP → Web: Barkod
  async transformBarkodFromERP(erpBarkod) {
    try {
      return {
        stok_kodu: erpBarkod.bar_stokkodu,
        barkod: erpBarkod.bar_kodu,
        barkod_tipi: this.getBarkodTipi(erpBarkod.bar_barkodtipi),
        aktif: erpBarkod.bar_iptal === 0,
        olusturma_tarihi: new Date(),
        guncelleme_tarihi: new Date()
      };
    } catch (error) {
      logger.error('Barkod transform hatası:', error);
      throw error;
    }
  }

  // ERP → Web: Fiyat Listesi
  async transformFiyatFromERP(erpFiyat) {
    try {
      return {
        fiyat: erpFiyat.sfiyat_fiyati,
        baslangic_tarihi: null, // ERP'de bu alan yok
        bitis_tarihi: null, // ERP'de bu alan yok
        olusturma_tarihi: new Date(),
        guncelleme_tarihi: new Date()
      };
    } catch (error) {
      logger.error('Fiyat transform hatası:', error);
      throw error;
    }
  }

  getBarkodTipi(erpTipi) {
    const tipler = {
      '1': 'ana',
      '2': 'koli',
      '3': 'palet'
    };
    return tipler[erpTipi] || 'ana';
  }
}

module.exports = new StokTransformer();
