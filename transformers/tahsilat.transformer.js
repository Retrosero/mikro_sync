const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

class TahsilatTransformer {
  // Web → ERP: Tahsilat
  async transformTahsilat(webTahsilat, odemeEmriRefno = null) {
    try {
      const cariKod = await lookupTables.getCariKod(webTahsilat.cari_hesap_id);

      if (!cariKod) {
        throw new Error(`Cari mapping bulunamadı: ${webTahsilat.cari_hesap_id}`);
      }

      // Tahsilat tipine göre mapping (Trace dosyalarından öğrenilen kurallar)
      let chaTpoz = 0; // Trace'lerde hep 0
      let chaCariCins = 0; // Müşteri
      let chaKod = cariKod; // Müşteri kodu
      let chaKasaHizkod = '';
      let chaKasaHizmet = 0; // 0=Yok, 1=Cari, 2=Banka, 3=Hizmet, 4=Kasa
      let chaCinsi = 0; // 0=Nakit, 1=Çek, 2=Senet, 17=Havale, 19=Kredi Kartı
      let chaAciklama = webTahsilat.aciklama || '';
      let chaTrefno = '';
      let chaSntckPoz = 0;
      let chaGrupno = 0;
      let chaKarsidgrupno = 0;
      let chaCiroCariKodu = '';

      if (webTahsilat.tahsilat_tipi === 'nakit') {
        // NAKİT: Trace'de cha_cari_cins=4 (Kasa), cha_kod=kasa_kodu, cha_cinsi=0
        chaCariCins = 4;
        chaKasaHizmet = 4; // Kasa
        const kasaKod = await lookupTables.getKasaKod(webTahsilat.kasa_id);
        if (kasaKod) {
          chaKod = kasaKod;
          chaKasaHizkod = kasaKod;
        }
        chaCinsi = 0;
        chaAciklama = webTahsilat.aciklama || 'tahsilat-nakit';

      } else if (webTahsilat.tahsilat_tipi === 'cek') {
        // ÇEK: Trace'de cha_cari_cins=0, cha_kod=cari_kod, cha_cinsi=1, cha_kasa_hizkod='ÇEK'
        chaCariCins = 0;
        chaKasaHizmet = 4; // Kasa (Çek Kasası)
        chaKod = cariKod;
        chaCinsi = 1;
        chaKasaHizkod = 'ÇEK';
        chaTrefno = odemeEmriRefno || '';
        chaSntckPoz = 0;
        // Çek bilgilerini açıklamaya ekle
        chaAciklama = this.formatCekAciklama(
          webTahsilat.cek_no,
          webTahsilat.banka_adi,
          webTahsilat.sube_adi,
          webTahsilat.hesap_no
        );

      } else if (webTahsilat.tahsilat_tipi === 'senet') {
        // SENET: Trace'de cha_cari_cins=0, cha_kod=cari_kod, cha_cinsi=2, cha_kasa_hizkod='SENET'
        chaCariCins = 0;
        chaKasaHizmet = 4; // Kasa (Senet Kasası)
        chaKod = cariKod;
        chaCinsi = 2;
        chaKasaHizkod = 'SENET';
        chaTrefno = odemeEmriRefno || '';
        chaSntckPoz = 0;
        // Senet bilgilerini açıklamaya ekle
        chaAciklama = this.formatSenetAciklama(
          webTahsilat.banka_adi,
          webTahsilat.sube_adi
        );

      } else if (webTahsilat.tahsilat_tipi === 'havale') {
        // HAVALE: Trace'de cha_cari_cins=0, cha_kod=cari_kod, cha_cinsi=17, cha_kasa_hizkod=banka_kod, cha_sntck_poz=2
        chaCariCins = 0;
        chaKasaHizmet = 2; // Banka
        chaKod = cariKod;
        chaCinsi = 17;
        const bankaKod = await lookupTables.getBankaKod(webTahsilat.banka_id);
        if (bankaKod) {
          chaKasaHizkod = bankaKod;
        }
        chaTrefno = odemeEmriRefno || '';
        chaSntckPoz = 2;
        chaAciklama = '';

        // Banka grup no'yu al
        const pgService = require('../services/postgresql.service');
        const bankaInfo = await pgService.query(
          'SELECT erp_grup_no FROM bankalar WHERE id = $1',
          [webTahsilat.banka_id]
        );
        if (bankaInfo.length > 0 && bankaInfo[0].erp_grup_no) {
          chaKarsidgrupno = bankaInfo[0].erp_grup_no;
        }

      } else if (webTahsilat.tahsilat_tipi === 'kredi_karti') {
        // KREDİ KARTI: Trace'de cha_cari_cins=0, cha_kod=cari_kod, cha_cinsi=19, cha_kasa_hizkod=banka_kod, cha_sntck_poz=2
        chaCariCins = 0;
        chaKasaHizmet = 2; // Banka
        chaKod = cariKod;
        chaCinsi = 19;
        const bankaKod = await lookupTables.getBankaKod(webTahsilat.banka_id);
        if (bankaKod) {
          chaKasaHizkod = bankaKod;
        }
        chaTrefno = odemeEmriRefno || '';
        chaSntckPoz = 2;
        chaSntckPoz = 2;
        chaAciklama = '';

        // Banka grup no'yu al
        const pgService = require('../services/postgresql.service');
        const bankaInfo = await pgService.query(
          'SELECT erp_grup_no FROM bankalar WHERE id = $1',
          [webTahsilat.banka_id]
        );
        if (bankaInfo.length > 0 && bankaInfo[0].erp_grup_no) {
          chaKarsidgrupno = bankaInfo[0].erp_grup_no;
        }
      }

      return {
        cha_tarihi: webTahsilat.tahsilat_tarihi,
        cha_belge_tarih: webTahsilat.tahsilat_tarihi,
        cha_kod: chaKod,
        cha_ciro_cari_kodu: chaCiroCariKodu,
        cha_meblag: webTahsilat.tutar,
        cha_aratoplam: webTahsilat.tutar,
        cha_aciklama: chaAciklama.substring(0, 80), // Maksimum 80 karakter
        cha_tpoz: chaTpoz,
        cha_cari_cins: chaCariCins,
        cha_evrak_tip: 1,
        cha_tip: 1,
        cha_cinsi: chaCinsi,
        cha_normal_Iade: 0,
        cha_evrakno_sira: webTahsilat.tahsilat_sira_no,
        cha_evrakno_seri: webTahsilat.tahsilat_seri_no || '',
        cha_vade: this.formatDateToInt(webTahsilat.tahsilat_tarihi), // YYYYMMDD formatında integer
        cha_grupno: chaGrupno,
        cha_karsidgrupno: chaKarsidgrupno,
        cha_trefno: chaTrefno,
        cha_sntck_poz: chaSntckPoz,
        // Standart Değerler
        cha_d_cins: 0, // TL
        cha_d_kur: 1,
        cha_altd_kur: 1,
        cha_karsid_kur: 1,
        cha_create_user: 1,
        cha_lastup_user: 1,
        cha_firmano: 0,
        cha_subeno: 0,
        cha_kasa_hizmet: chaCariCins === 4 ? 4 : (chaCariCins === 2 ? 2 : 0),
        cha_kasa_hizkod: chaKasaHizkod
      };
    } catch (error) {
      logger.error('Tahsilat transform hatası:', error);
      throw error;
    }
  }

  // Çek/Senet/Havale/Kredi Kartı için ODEME_EMIRLERI kaydı
  async transformOdemeEmri(webTahsilat) {
    if (!['cek', 'senet', 'havale', 'kredi_karti'].includes(webTahsilat.tahsilat_tipi)) {
      return null;
    }

    try {
      const cariKod = await lookupTables.getCariKod(webTahsilat.cari_hesap_id);

      // Müşteri adını ve telefonu al
      const pgService = require('../services/postgresql.service');
      const cariInfo = await pgService.query(
        'SELECT cari_adi, telefon FROM cari_hesaplar WHERE id = $1',
        [webTahsilat.cari_hesap_id]
      );

      const cariAdi = cariInfo.length > 0 ? cariInfo[0].cari_adi : '';
      const cariTel = cariInfo.length > 0 ? (cariInfo[0].telefon || '') : '';

      // banka_adi alanını parse et (Banka - Şube - Hesap formatında olabilir)
      let bankaAdi = webTahsilat.banka_adi || '';
      let subeAdi = '';
      let hesapNo = '';

      if (bankaAdi && bankaAdi.includes(' - ')) {
        const parts = bankaAdi.split(' - ');
        bankaAdi = parts[0] || '';
        subeAdi = parts[1] || '';
        hesapNo = parts[2] || '';
      }

      // Ödeme tipi kodları (Trace'den)
      const tipKodlari = {
        'cek': 0,
        'senet': 1,
        'havale': 4,
        'kredi_karti': 6
      };

      const sckTip = tipKodlari[webTahsilat.tahsilat_tipi];

      // Refno oluştur
      const tipPrefix = {
        'cek': 'MC',
        'senet': 'MS',
        'havale': 'MH',
        'kredi_karti': 'MK'
      };

      const prefix = tipPrefix[webTahsilat.tahsilat_tipi];
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
      const refno = `${prefix}-000-000-${year}-${randomNum}`;

      return {
        sck_tip: sckTip,
        sck_refno: refno,
        sck_no: webTahsilat.cek_no || '',
        sck_banka_adres1: bankaAdi,
        sck_sube_adres2: subeAdi,
        sck_hesapno_sehir: hesapNo,
        sck_borclu: cariAdi,
        sck_vdaire_no: ' ', // Trace'de boş string
        sck_borclu_tel: cariTel,
        sck_tutar: webTahsilat.tutar,
        sck_vade: webTahsilat.cek_vade_tarihi || webTahsilat.vade_tarihi || webTahsilat.tahsilat_tarihi,
        sck_duzen_tarih: webTahsilat.tahsilat_tarihi,
        sck_sahip_cari_kodu: cariKod,
        sck_doviz: 0, // 0: TL (Trace'de 0)
        sck_odenen: 0, // Henüz ödenmedi
        sck_iptal: 0,
        sck_degerleme_islendi: 0
      };
    } catch (error) {
      logger.error('Ödeme emri transform hatası:', error);
      throw error;
    }
  }

  formatCekAciklama(cekNo, bankaAdi, subeAdi, hesapNo) {
    // banka_adi alanı "Banka - Şube - Hesap" formatında gelebilir
    let banka = bankaAdi || '';
    let sube = subeAdi || '';
    let hesap = hesapNo || '';

    if (bankaAdi && bankaAdi.includes(' - ')) {
      const parts = bankaAdi.split(' - ');
      banka = parts[0] || '';
      sube = parts[1] || '';
      hesap = parts[2] || '';
    }

    return '/' +
      (cekNo || '') + '/' +
      banka + '/' +
      sube + '/' +
      hesap;
  }

  formatSenetAciklama(bankaAdi, subeAdi) {
    // banka_adi alanı "Şehir - İlçe" formatında gelebilir
    let adres = bankaAdi || '';
    let sehir = subeAdi || '';

    if (bankaAdi && bankaAdi.includes(' - ')) {
      const parts = bankaAdi.split(' - ');
      adres = parts[0] || '';
      sehir = parts[1] || '';
    }

    // Trace'de: '//adres//şehir' formatında
    return '//' +
      adres + '//' +
      sehir;
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

  formatDateToInt(date) {
    // Tarihi YYYYMMDD formatında integer'a çevir (ERP trace'lerinde bu formatta)
    if (!date) return 0;

    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return parseInt(`${year}${month}${day}`);
  }
}

module.exports = new TahsilatTransformer();
