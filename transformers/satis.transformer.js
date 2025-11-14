const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

class SatisTransformer {
  // Web → ERP: Satış Başlık
  async transformSatisBaslik(webSatis) {
    try {
      const cariKod = await lookupTables.getCariKod(webSatis.cari_hesap_id);
      
      if (!cariKod) {
        throw new Error(`Cari mapping bulunamadı: ${webSatis.cari_hesap_id}`);
      }

      // Ödeme şekline göre cha_tpoz ve cha_cari_cins belirleme
      let chaTpoz = 0;
      let chaCariCins = 0;
      
      if (webSatis.odeme_sekli === 'veresiye' || webSatis.odeme_sekli === 'acikhesap') {
        chaTpoz = 0;
        chaCariCins = 0;
      }
      // Peşin satışlarda başlık yazılmaz, sadece tahsilat yazılır

      return {
        cha_tarihi: webSatis.satis_tarihi,
        cha_belge_tarih: webSatis.satis_tarihi,
        cha_evrakno_sira: webSatis.fatura_sira_no,
        cha_evrakno_seri: webSatis.fatura_seri_no || '',
        cha_kod: cariKod,
        cha_meblag: webSatis.toplam_tutar,
        cha_aratoplam: webSatis.ara_toplam,
        cha_aciklama: webSatis.notlar || '',
        cha_tpoz: chaTpoz,
        cha_cari_cins: chaCariCins,
        cha_ft_iskonto1: webSatis.indirim_tutari || 0,
        cha_ft_iskonto2: webSatis.indirim_tutari2 || 0,
        cha_ft_iskonto3: webSatis.indirim_tutari3 || 0,
        cha_ft_iskonto4: webSatis.indirim_tutari4 || 0,
        cha_ft_iskonto5: webSatis.indirim_tutari5 || 0,
        cha_ft_iskonto6: webSatis.indirim_tutari6 || 0,
        cha_evrak_tip: 63,
        cha_tip: 0,
        cha_cinsi: 6,
        cha_normal_iade: 0
      };
    } catch (error) {
      logger.error('Satış başlık transform hatası:', error);
      throw error;
    }
  }

  // Web → ERP: Satış Satır
  async transformSatisKalem(webKalem, webSatis) {
    try {
      const stokKod = await lookupTables.getStokKod(webKalem.stok_id);
      const cariKod = await lookupTables.getCariKod(webSatis.cari_hesap_id);
      const kdvPointer = await lookupTables.getKdvPointer(webKalem.kdv_orani);

      if (!stokKod) {
        throw new Error(`Stok mapping bulunamadı: ${webKalem.stok_id}`);
      }

      return {
        sth_stok_kod: stokKod,
        sth_miktar: webKalem.miktar,
        sth_iskonto1: webKalem.indirim_tutari || 0,
        sth_iskonto2: webKalem.indirim_tutari2 || 0,
        sth_iskonto3: webKalem.indirim_tutari3 || 0,
        sth_iskonto4: webKalem.indirim_tutari4 || 0,
        sth_iskonto5: webKalem.indirim_tutari5 || 0,
        sth_iskonto6: webKalem.indirim_tutari6 || 0,
        sth_tutar: webKalem.toplam_tutar,
        sth_vergi: webKalem.kdv_tutari || 0,
        sth_vergi_pntr: kdvPointer,
        sth_tarih: webSatis.satis_tarihi,
        sth_belge_tarih: webSatis.satis_tarihi,
        sth_cari_kodu: cariKod,
        sth_cikis_depo_no: 1, // Konfig'den alınabilir
        sth_giris_depo_no: 0,
        sth_tip: 1,
        sth_cins: 0,
        sth_normal_iade: 0,
        sth_evraktip: 4,
        sth_evrakno_sira: webSatis.fatura_sira_no,
        sth_evrakno_seri: webSatis.fatura_seri_no || ''
      };
    } catch (error) {
      logger.error('Satış kalem transform hatası:', error);
      throw error;
    }
  }

  // ERP → Web: Satış verisi (gerekirse)
  async transformFromERP(erpData) {
    // ERP'den web'e satış senkronizasyonu gerekirse buraya eklenebilir
    return null;
  }
}

module.exports = new SatisTransformer();
