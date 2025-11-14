const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

class StokTransformer {
  // ERP → Web: Stok Kartı
  async transformFromERP(erpStok) {
    try {
      return {
        stok_kodu: erpStok.sto_kod,
        stok_adi: erpStok.sto_isim,
        birim_turu: erpStok.sto_birim1_ad || 'Adet',
        alis_fiyati: erpStok.sto_standartmaliyet || 0,
        satis_fiyati: erpStok.sto_satisfiyati || 0,
        aciklama: erpStok.sto_aciklama || '',
        olcu: erpStok.sto_sektor_kodu || '',
        raf_kodu: erpStok.sto_reyon_kodu || '',
        ambalaj: erpStok.sto_ambalaj_kodu || '',
        koliadeti: erpStok.sto_kalkon_kodu || 0,
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
        barkod: erpBarkod.bar_kod,
        barkod_tipi: this.getBarkodTipi(erpBarkod.bar_tipi),
        aktif: erpBarkod.bar_pasif_fl === 0,
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
        baslangic_tarihi: erpFiyat.sfiyat_bas_tarih,
        bitis_tarihi: erpFiyat.sfiyat_bit_tarih,
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
