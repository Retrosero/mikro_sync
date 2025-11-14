const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

class TahsilatTransformer {
  // Web → ERP: Tahsilat
  async transformTahsilat(webTahsilat) {
    try {
      const cariKod = await lookupTables.getCariKod(webTahsilat.cari_hesap_id);
      
      if (!cariKod) {
        throw new Error(`Cari mapping bulunamadı: ${webTahsilat.cari_hesap_id}`);
      }

      // Tahsilat tipine göre mapping
      let chaTpoz = 1;
      let chaCariCins = 0;
      let chaKod = cariKod;
      let chaEvrakTip = 1;
      let chaAciklama = webTahsilat.aciklama || '';

      if (webTahsilat.tahsilat_tipi === 'nakit') {
        // Kasa
        chaCariCins = 4;
        const kasaKod = await lookupTables.getKasaKod(webTahsilat.kasa_id);
        if (kasaKod) chaKod = kasaKod;
      } else if (webTahsilat.tahsilat_tipi === 'kredi_karti' || webTahsilat.tahsilat_tipi === 'havale') {
        // Banka
        chaCariCins = 2;
        const bankaKod = await lookupTables.getBankaKod(webTahsilat.banka_id);
        if (bankaKod) chaKod = bankaKod;
      } else if (webTahsilat.tahsilat_tipi === 'cek') {
        // Çek
        chaCariCins = 0;
        // Çek bilgilerini açıklamaya ekle
        chaAciklama = this.formatCekAciklama(
          webTahsilat.cek_no,
          webTahsilat.banka_adi,
          webTahsilat.sube_adi,
          webTahsilat.hesap_no
        );
      } else if (webTahsilat.tahsilat_tipi === 'senet') {
        // Senet
        chaCariCins = 0;
        chaAciklama = 'SENET - ' + (webTahsilat.aciklama || '');
      }

      return {
        cha_tarihi: webTahsilat.tahsilat_tarihi,
        cha_belge_tarih: webTahsilat.tahsilat_tarihi,
        cha_kod: chaKod,
        cha_meblag: webTahsilat.tutar,
        cha_aratoplam: webTahsilat.tutar,
        cha_aciklama: chaAciklama,
        cha_tpoz: chaTpoz,
        cha_cari_cins: chaCariCins,
        cha_evrak_tip: chaEvrakTip,
        cha_tip: 1,
        cha_cinsi: 0,
        cha_normal_iade: 0,
        cha_evrakno_sira: webTahsilat.tahsilat_sira_no,
        cha_evrakno_seri: webTahsilat.tahsilat_seri_no || '',
        cha_vade: webTahsilat.vade_tarihi || webTahsilat.tahsilat_tarihi
      };
    } catch (error) {
      logger.error('Tahsilat transform hatası:', error);
      throw error;
    }
  }

  // Çek/Senet için ODEME_EMIRLERI kaydı
  async transformOdemeEmri(webTahsilat) {
    if (webTahsilat.tahsilat_tipi !== 'cek' && webTahsilat.tahsilat_tipi !== 'senet') {
      return null;
    }

    try {
      const cariKod = await lookupTables.getCariKod(webTahsilat.cari_hesap_id);

      return {
        sck_no: webTahsilat.cek_no || '',
        sck_banka_adres1: webTahsilat.banka_adi || '',
        sck_sube_adres2: webTahsilat.sube_adi || '',
        sck_hesapno_sehir: webTahsilat.hesap_no || '',
        sck_tutar: webTahsilat.tutar,
        sck_vade: webTahsilat.cek_vade_tarihi || webTahsilat.vade_tarihi,
        sck_duzen_tarih: webTahsilat.tahsilat_tarihi,
        sck_sahip_cari_kodu: cariKod,
        sck_tip: 0, // Müşteriden alınan
        sck_doviz: 1, // TL
        sck_odenen: 0, // Henüz ödenmedi
        sck_iptal: 0
      };
    } catch (error) {
      logger.error('Ödeme emri transform hatası:', error);
      throw error;
    }
  }

  formatCekAciklama(cekNo, bankaAdi, subeAdi, hesapNo) {
    return '/' + 
      (cekNo || '') + '/' + 
      (bankaAdi || '') + '/' + 
      (subeAdi || '') + '/' + 
      (hesapNo || '');
  }

  parseCekAciklama(aciklama) {
    if (!aciklama || !aciklama.startsWith('/')) {
      return null;
    }

    const parts = aciklama.split('/');
    return {
      cek_no: parts[1] || null,
      banka_adi: parts[2] || null,
      sube_adi: parts[3] || null,
      hesap_no: parts[4] || null
    };
  }
}

module.exports = new TahsilatTransformer();
