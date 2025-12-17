const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

// Tarih formatını MSSQL için dönüştür - SAAT OLMADAN (YYYY-MM-DD 00:00:00.000)
function formatDateOnlyForMSSQL(date) {
  if (!date) return '1899-12-30 00:00:00.000';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} 00:00:00.000`;
}

// Tarih formatını MSSQL için dönüştür - SAAT İLE (YYYY-MM-DD HH:MM:SS.mmm)
function formatDateTimeForMSSQL(date) {
  if (!date) return '1899-12-30 00:00:00.000';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const milliseconds = String(d.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

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
        // NAKİT: User Request Update -> cha_cari_cins=0, cha_kod=cariKod, cha_ciro_cari_kodu=''
        chaCariCins = 0;
        chaKasaHizmet = 4; // Kasa (Hizmet Tipi Kasa)

        // Kasa kodunu sadece Hizot Kodu alanına yazıyoruz, cha_kod Müşteri kalıyor
        const kasaKod = await lookupTables.getKasaKod(webTahsilat.kasa_id);
        if (kasaKod) {
          chaKasaHizkod = kasaKod;
        } else {
          logger.warn(`Tahsilat ${webTahsilat.id} için Kasa Kodu bulunamadı!`);
        }

        chaKod = cariKod; // İstenen: Müşteri Kodu
        chaCiroCariKodu = ''; // İstenen: Boş

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
        // User Request: /çekno///açıklama formatında olmalı
        const cekNo = webTahsilat.cek_no || '';
        const webAciklama = webTahsilat.aciklama || '';
        chaAciklama = `/${cekNo}///${webAciklama}`;

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
        // User Request: /senetno///açıklama formatında
        const senetNo = webTahsilat.cek_no || ''; // Senet no genelde çek no alanında gelir
        const webAciklama = webTahsilat.aciklama || '';
        chaAciklama = `/${senetNo}///${webAciklama}`;

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

      logger.info(`Tahsilat Transform (${webTahsilat.tahsilat_tipi}): chaKod=${chaKod}, chaCiroCariKodu=${chaCiroCariKodu}, chaKasaHizmet=${chaKasaHizmet}`);

      return {
        cha_tarihi: webTahsilat.tahsilat_tarihi,
        cha_belge_tarih: webTahsilat.tahsilat_tarihi,
        cha_kod: chaKod,
        cha_ciro_cari_kodu: chaCiroCariKodu,
        cha_meblag: webTahsilat.tutar,
        cha_aratoplam: webTahsilat.tutar,
        // Açıklama: Formatted açıklama + Web açıklama (Duplicate kontrolü ile)
        cha_aciklama: (() => {
          const webAciklama = webTahsilat.aciklama || '';

          // Eğer özel format (Çek/Senet gibi / ile başlıyorsa) dokunma
          if (chaAciklama.startsWith('/')) {
            return chaAciklama;
          }

          // Eğer formatted açıklama zaten web açıklamasını içeriyorsa veya web açıklaması formatted açıklama ile aynıysa
          if (chaAciklama.includes(webAciklama)) {
            return chaAciklama;
          }
          // Nakit tahsilat default değeri kontrolü
          if (chaAciklama === 'tahsilat-nakit' && webAciklama) {
            return webAciklama;
          }
          return (chaAciklama + (webAciklama ? ' ' + webAciklama : '')).trim();
        })().substring(0, 80),
        cha_tpoz: chaTpoz,
        cha_cari_cins: chaCariCins,
        cha_evrak_tip: 1,
        cha_tip: 1,
        cha_cinsi: chaCinsi,
        cha_normal_Iade: 0,
        cha_evrakno_sira: webTahsilat.tahsilat_sira_no,
        cha_evrakno_seri: webTahsilat.tahsilat_seri_no || '',
        // Vade tarihi: Web'den gelen vade tarihini (veya çek vadesini) kullan
        cha_vade: this.formatDateToInt(webTahsilat.cek_vade_tarihi || webTahsilat.vade_tarihi || webTahsilat.tahsilat_tarihi),
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
        cha_kasa_hizmet: chaKasaHizmet,
        cha_kasa_hizkod: chaKasaHizkod,

        // Diğer Standart Değerler (NULL gitmemesi gerekenler)
        cha_satir_no: 0,
        cha_ticaret_turu: 0,
        cha_belge_no: '',
        cha_srmrkkodu: '',
        cha_karsidcinsi: 0,
        cha_karsid_kur: 1,
        cha_karsidgrupno: chaKarsidgrupno, // Yukarıda hesaplanıyor ama default 0 da olabilir
        cha_karsisrmrkkodu: '',
        cha_miktari: 0,
        cha_Vade_Farki_Yuz: 0,
        cha_ft_iskonto1: 0, cha_ft_iskonto2: 0, cha_ft_iskonto3: 0, cha_ft_iskonto4: 0, cha_ft_iskonto5: 0, cha_ft_iskonto6: 0,
        cha_ft_masraf1: 0, cha_ft_masraf2: 0, cha_ft_masraf3: 0, cha_ft_masraf4: 0,
        cha_isk_mas1: 0, cha_isk_mas2: 0, cha_isk_mas3: 0, cha_isk_mas4: 0, cha_isk_mas5: 0,
        cha_isk_mas6: 0, cha_isk_mas7: 0, cha_isk_mas8: 0, cha_isk_mas9: 0, cha_isk_mas10: 0,
        cha_sat_iskmas1: 0, cha_sat_iskmas2: 0, cha_sat_iskmas3: 0, cha_sat_iskmas4: 0, cha_sat_iskmas5: 0,
        cha_sat_iskmas6: 0, cha_sat_iskmas7: 0, cha_sat_iskmas8: 0, cha_sat_iskmas9: 0, cha_sat_iskmas10: 0,
        cha_yuvarlama: 0,
        cha_StFonPntr: 0,
        cha_stopaj: 0,
        cha_savsandesfonu: 0,
        cha_avansmak_damgapul: 0,
        cha_vergipntr: 0,
        cha_vergi1: 0, cha_vergi2: 0, cha_vergi3: 0, cha_vergi4: 0, cha_vergi5: 0,
        cha_vergi6: 0, cha_vergi7: 0, cha_vergi8: 0, cha_vergi9: 0, cha_vergi10: 0,
        cha_vergisiz_fl: 0,
        cha_otvtutari: 0,
        cha_otvvergisiz_fl: 0,
        cha_oiv_pntr: 0,
        cha_oivtutari: 0,
        cha_oiv_vergi: 0,
        cha_oivergisiz_fl: 0,
        cha_fis_tarih: new Date('1899-12-30T00:00:00Z'),
        cha_fis_sirano: 0,
        cha_reftarihi: new Date('1899-12-30T00:00:00Z'),
        cha_istisnakodu: 0,
        cha_pos_hareketi: 0,
        cha_meblag_ana_doviz_icin_gecersiz_fl: 0,
        cha_meblag_alt_doviz_icin_gecersiz_fl: 0,
        cha_meblag_orj_doviz_icin_gecersiz_fl: 0,
        cha_sip_recid_dbcno: 0,
        cha_sip_recid_recno: 0,
        cha_kirahar_recid_dbcno: 0,
        cha_kirahar_recid_recno: 0,
        cha_vardiya_tarihi: new Date('1899-12-30T00:00:00Z'),
        cha_vardiya_no: 0,
        cha_vardiya_evrak_ti: 0,
        cha_ebelge_cinsi: 0,
        cha_tevkifat_toplam: 0,
        cha_ilave_edilecek_kdv1: 0, cha_ilave_edilecek_kdv2: 0, cha_ilave_edilecek_kdv3: 0,
        cha_ilave_edilecek_kdv4: 0, cha_ilave_edilecek_kdv5: 0, cha_ilave_edilecek_kdv6: 0,
        cha_ilave_edilecek_kdv7: 0, cha_ilave_edilecek_kdv8: 0, cha_ilave_edilecek_kdv9: 0,
        cha_ilave_edilecek_kdv10: 0,
        cha_e_islem_turu: 0,
        cha_fatura_belge_turu: 0,
        cha_diger_belge_adi: '',
        cha_uuid: null,

        // Code ve Special Alanları
        cha_special1: '', cha_special2: '', cha_special3: '',
        cha_projekodu: '', cha_yat_tes_kodu: '', cha_satici_kodu: '', cha_EXIMkodu: ''
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

      const cariAdi = cariInfo.length > 0 ? (cariInfo[0].cari_adi || '').substring(0, 50) : '';
      const cariTel = cariInfo.length > 0 ? (cariInfo[0].telefon || '').substring(0, 20) : '';

      // banka_adi alanını parse et
      let bankaAdi = webTahsilat.banka_adi || '';
      let subeAdi = webTahsilat.sube_adi || '';
      let hesapNo = webTahsilat.hesap_no || '';

      // Ödeme tipi kodları ve Prefixler
      const tipMapping = {
        'cek': { code: 0, prefix: 'MC', name: 'ÇEK', cins: 4 },
        'senet': { code: 1, prefix: 'MS', name: 'SENET', cins: 4 },
        'havale': { code: 4, prefix: 'MH', name: 'HAVALE', cins: 2 }, // Havale banka olabilir
        'kredi_karti': { code: 6, prefix: 'MK', name: 'KREDİ KARTI', cins: 2 }
      };

      const mapping = tipMapping[webTahsilat.tahsilat_tipi];
      const sckTip = mapping.code;
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
      // RefNo: TipPrefix-000-000-YYYY-Random
      const refno = `${mapping.prefix}-000-000-${year}-${randomNum}`;

      const creationDate = formatDateTimeForMSSQL(new Date());

      // Keside Yeri (Şehir) - Web'den şube adı veya banka adından çıkarılabilir sehir
      // Basitçe banka adı varsa onu, yoksa boş kullanalım
      const kesideYeri = (webTahsilat.banka_adi || '').substring(0, 20);

      return {
        // --- TEMEL ALANLAR ---
        sck_tip: sckTip,
        sck_refno: refno,
        sck_no: (webTahsilat.cek_no || '').substring(0, 20),

        // --- TARİHLER ---
        sck_create_date: creationDate,
        sck_lastup_date: creationDate,
        sck_vade: formatDateOnlyForMSSQL(webTahsilat.cek_vade_tarihi || webTahsilat.vade_tarihi || webTahsilat.tahsilat_tarihi),
        sck_duzen_tarih: '1899-12-30 00:00:00.000', // Sabit
        sck_ilk_hareket_tarihi: formatDateOnlyForMSSQL(webTahsilat.tahsilat_tarihi),
        sck_son_hareket_tarihi: formatDateOnlyForMSSQL(webTahsilat.tahsilat_tarihi),
        sck_RECid_DBCno: 0,
        sck_RECid_RECno: 0,
        sck_SpecRECno: 0,

        // --- CARİ VE POSİSYON ---
        sck_sahip_cari_cins: 0,
        sck_sahip_cari_kodu: cariKod,
        sck_sahip_cari_grupno: 0,

        sck_nerede_cari_cins: mapping.cins, // 4=Kasa (Çek/Senet), 2=Banka
        sck_nerede_cari_kodu: mapping.name, // 'ÇEK', 'SENET' vs.
        sck_nerede_cari_grupno: 0,

        sck_sonpoz: 0, // Portföyde

        // --- TUTAR ---
        sck_tutar: webTahsilat.tutar,
        sck_doviz: 0, // TL
        sck_doviz_kur: 1,
        sck_odenen: 0,

        // --- Kişi/Kurum Bilgileri ---
        sck_borclu: cariAdi,
        sck_borclu_tel: cariTel,
        sck_bankano: '',
        sck_vdaire_no: '',
        sck_banka_adres1: bankaAdi.substring(0, 50),
        sck_sube_adres2: subeAdi.substring(0, 50),
        sck_hesapno_sehir: hesapNo.substring(0, 20),
        sck_kesideyeri: kesideYeri,

        // --- Evrak Bilgileri ---
        sck_ilk_evrak_seri: 'T', // Tahsilat
        sck_ilk_evrak_sira_no: webTahsilat.tahsilat_sira_no || 0,
        sck_ilk_evrak_satir_no: 1,

        // --- SABİT/DEFAULT DEĞERLER (User Request: 0 olanlar 0, boş olanlar boş) ---
        sck_iptal: 0,
        sck_fileid: 54, // User example: 54
        sck_hidden: 0,
        sck_kilitli: 0,
        sck_degisti: 0,
        sck_checksum: 0,
        sck_create_user: 1,
        sck_lastup_user: 1,
        sck_special1: '',
        sck_special2: '',
        sck_special3: '',
        sck_firmano: 0,
        sck_subeno: 0,
        sck_degerleme_islendi: 0,
        sck_imza: 0,
        sck_srmmrk: '',
        Sck_TCMB_Banka_kodu: '',
        Sck_TCMB_Sube_kodu: '',
        Sck_TCMB_il_kodu: '',
        SckTasra_fl: 0,
        sck_projekodu: '',
        sck_masraf1: 0,
        sck_masraf1_isleme: 0,
        sck_masraf2: 0,
        sck_masraf2_isleme: 0,
        sck_odul_katkisi_tutari: 0,
        sck_servis_komisyon_tutari: 0,
        sck_erken_odeme_faiz_tutari: 0,
        sck_odul_katkisi_tutari_islendi_fl: 0,
        sck_servis_komisyon_tutari_islendi_fl: 0,
        sck_erken_odeme_faiz_tutari_islendi_fl: 0,
        sck_kredi_karti_tipi: 0,
        sck_taksit_sayisi: 0,
        sck_kacinci_taksit: 0,
        sck_uye_isyeri_no: '',
        sck_kredi_karti_no: '',
        sck_provizyon_kodu: ''
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
