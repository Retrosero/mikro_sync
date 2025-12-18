const lookupTables = require('../mappings/lookup-tables');
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Tarih formatını MSSQL için dönüştür - SAAT OLMADAN (YYYY-MM-DD 00:00:00.000)
function formatDateOnlyForMSSQL(date) {
  if (!date) {
    date = new Date();
  }

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day} 00:00:00.000`;
}

// Tarih formatını MSSQL için dönüştür - SAAT İLE (YYYY-MM-DD HH:MM:SS.mmm)
function formatDateTimeForMSSQL(date) {
  if (!date) {
    date = new Date();
  }

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

class SatisTransformer {
  // Web → ERP: Satış Başlık
  async transformSatisBaslik(webSatis) {
    try {
      logger.info(`transformSatisBaslik BAŞLIYOR: ID=${webSatis.id} HareketTuru=${webSatis.hareket_turu} BankaKodu=${webSatis.banka_kodu} KasaKodu=${webSatis.kasa_kodu}`);
      const cariKod = await lookupTables.getCariKod(webSatis.cari_hesap_id);

      if (!cariKod) {
        throw new Error(`Cari mapping bulunamadı: ${webSatis.cari_hesap_id}`);
      }

      // Ödeme şekline göre cha_tpoz, cha_cari_cins, cha_grupno belirleme
      let chaTpoz, chaCariCins, chaGrupno;

      // KULLANICI İSTEĞİ: cha_tpoz ve cha_grupno HER ZAMAN 1 OLMALI
      chaTpoz = 1;
      chaGrupno = 1;
      // Ödeme Şekli normalizasyonu (küçük harf, trim)
      const oSekli = (webSatis.odeme_sekli || '').toLowerCase().trim();

      // Ödeme şekline veya mevcut ID'lere göre cari_cins belirle
      // Nakit veya Kasa
      if (oSekli === 'nakit' || webSatis.kasa_id || webSatis.kasa_kodu) {
        chaCariCins = 4; // Kasa
      }
      // Banka (Kredi Kartı, Havale)
      else if (oSekli === 'kredi_karti' || oSekli === 'havale' || webSatis.banka_id || webSatis.banka_kodu) {
        chaCariCins = 2; // Banka
      }
      // Çek / Senet (Eğer ödeme şeklinde gelirse)
      else if (oSekli === 'cek' || oSekli === 'senet') {
        chaCariCins = 0;
      }
      else {
        // Diğer durumlar (Veresiye/Açık Hesap)
        chaCariCins = 0;
      }

      // İade kontrolü
      // DB'de satis_tipi kolonu var, fatura_tipi yok.
      const isIade = webSatis.satis_tipi === 'iade' || webSatis.fatura_tipi === 'iade' || webSatis.iade === true;

      // Override logic for specific requests if check needed
      // chaTpoz ve chaGrupno yukarıda 1 set edildi.

      // Peşin satışlarda başlık yazılmaz, sadece tahsilat yazılır

      // Banka/Kasa işlemlerinde kod ve ciro_cari_kodu ayarla
      let chaKod = cariKod;
      let chaCiroCariKodu = '';
      let chaAciklama = webSatis.notlar || ''; // Varsayılan not

      // chaCariCins 2 (Banka) veya 4 (Kasa) ise mapping yap
      if (chaCariCins === 2 || chaCariCins === 4) {
        // Bu durumda cha_kod -> Kasa/Banka Kodu olmalı
        // cha_ciro_cari_kodu -> Asıl Cari Kodu olmalı (Kullanıcı isteği)

        // 1. Asıl Cari Kodunu ciro_cari_kodu'na taşı
        chaCiroCariKodu = cariKod;

        // 2. Müşteri Adını açıklamaya ekle
        const cariInfo = await pgService.query(
          'SELECT cari_adi FROM cari_hesaplar WHERE id = $1',
          [webSatis.cari_hesap_id]
        );
        if (cariInfo.length > 0) {
          chaAciklama = cariInfo[0].cari_adi + (webSatis.notlar ? ' - ' + webSatis.notlar : '');
        }

        // 3. cha_kod'u belirle (Banka veya Kasa Kodu)
        // 3. cha_kod'u belirle (Banka veya Kasa Kodu)
        let mappedCode = null;

        if (chaCariCins === 2 && webSatis.banka_id) {
          mappedCode = await lookupTables.getBankaKod(webSatis.banka_id);
        } else if (chaCariCins === 4 && webSatis.kasa_id) {
          mappedCode = await lookupTables.getKasaKod(webSatis.kasa_id);
        }

        if (mappedCode) {
          chaKod = mappedCode;
        } else if (webSatis.banka_kodu) {
          // Kullanıcı isteği: Web'deki banka_kodu alanı (Kasa için de kullanılabilir)
          // Özellikle "Bankadan K." ise buradaki değeri kullan
          chaKod = webSatis.banka_kodu;
        } else if (webSatis.kasa_kodu) {
          chaKod = webSatis.kasa_kodu;
        } else if (chaCariCins === 4) {
          // Nakit satışlarda varsayılan kasa kodu 001
          chaKod = '001';
        }
      }

      return {
        cha_tarihi: webSatis.satis_tarihi,
        cha_belge_tarih: webSatis.satis_tarihi,
        cha_evrakno_sira: null, // Processor'da otomatik alınacak
        cha_evrakno_seri: webSatis.fatura_seri_no || '',
        cha_belge_no: '',
        cha_satir_no: 0, // Processor'da sırayla artırılacak
        cha_kod: chaKod,
        cha_ciro_cari_kodu: chaCiroCariKodu,
        cha_meblag: webSatis.toplam_tutar,
        cha_aratoplam: webSatis.ara_toplam,
        cha_aciklama: chaAciklama,
        cha_tpoz: chaTpoz,
        cha_cari_cins: chaCariCins,
        cha_ft_iskonto1: webSatis.iskonto1 || webSatis.indirim_tutari || 0,
        cha_ft_iskonto2: webSatis.iskonto2 || webSatis.indirim_tutari2 || 0,
        cha_ft_iskonto3: webSatis.iskonto3 || webSatis.indirim_tutari3 || 0,
        cha_ft_iskonto4: webSatis.iskonto4 || webSatis.indirim_tutari4 || 0,
        cha_ft_iskonto5: webSatis.iskonto5 || webSatis.indirim_tutari5 || 0,
        cha_ft_iskonto6: webSatis.iskonto6 || webSatis.indirim_tutari6 || 0,
        cha_evrak_tip: 63,
        cha_tip: 0,
        cha_cinsi: 6,
        cha_normal_Iade: isIade ? 1 : 0,
        // Standart Değerler
        cha_d_cins: 0, // TL
        cha_d_kur: 1,
        cha_altd_kur: 1,
        cha_karsid_kur: 1,
        cha_create_user: 1,
        cha_lastup_user: 1,
        cha_create_date: formatDateTimeForMSSQL(new Date()),
        cha_lastup_date: formatDateTimeForMSSQL(new Date()),
        cha_firmano: 0,
        cha_subeno: 0,
        cha_kasa_hizmet: 0,
        cha_kasa_hizkod: '',
        // Yeni alanlar
        cha_ticaret_turu: 0,
        cha_grupno: chaGrupno,
        cha_srmrkkodu: '',
        cha_karsidcinsi: 0,
        cha_special1: '',
        cha_special2: '',
        cha_special3: '',
        // Eksik alanlar - referans kaydından alınan değerler
        cha_satici_kodu: '',
        cha_EXIMkodu: '',
        cha_projekodu: '',
        cha_yat_tes_kodu: '',
        cha_karsidgrupno: 0,
        cha_karsisrmrkkodu: '',
        cha_miktari: 0,
        cha_vade: 0,
        cha_Vade_Farki_Yuz: 0,
        cha_ft_masraf1: 0,
        cha_ft_masraf2: 0,
        cha_ft_masraf3: 0,
        cha_ft_masraf4: 0,
        cha_isk_mas1: 0,
        cha_isk_mas2: 0,
        cha_isk_mas3: 0,
        cha_isk_mas4: 0,
        cha_isk_mas5: 0,
        cha_isk_mas6: 0,
        cha_isk_mas7: 0,
        cha_isk_mas8: 0,
        cha_isk_mas9: 0,
        cha_isk_mas10: 0,
        cha_sat_iskmas1: 0,
        cha_sat_iskmas2: 0,
        cha_sat_iskmas3: 0,
        cha_sat_iskmas4: 0,
        cha_sat_iskmas5: 0,
        cha_sat_iskmas6: 0,
        cha_sat_iskmas7: 0,
        cha_sat_iskmas8: 0,
        cha_sat_iskmas9: 0,
        cha_sat_iskmas10: 0,
        cha_yuvarlama: 0,
        cha_StFonPntr: 0,
        cha_stopaj: 0,
        cha_savsandesfonu: 0,
        cha_avansmak_damgapul: 0,
        cha_vergipntr: 0,
        cha_vergi1: 0,
        cha_vergi2: 0,
        cha_vergi3: 0,
        cha_vergi4: 0,
        cha_vergi5: 0,
        cha_vergi6: 0,
        cha_vergi7: 0,
        cha_vergi8: 0,
        cha_vergi9: 0,
        cha_vergi10: 0,
        cha_vergisiz_fl: 0,
        cha_otvtutari: 0,
        cha_otvvergisiz_fl: 0,
        cha_oiv_pntr: 0,
        cha_oivtutari: 0,
        cha_oiv_vergi: 0,
        cha_oivergisiz_fl: 0,
        cha_fis_tarih: '1899-12-30 00:00:00.000',
        cha_fis_sirano: 0,
        cha_trefno: '',
        cha_sntck_poz: 0,
        cha_reftarihi: '1899-12-30 00:00:00.000',
        cha_istisnakodu: 0,
        cha_pos_hareketi: 0,
        cha_meblag_ana_doviz_icin_gecersiz_fl: 0,
        cha_meblag_alt_doviz_icin_gecersiz_fl: 0,
        cha_meblag_orj_doviz_icin_gecersiz_fl: 0,
        cha_sip_recid_dbcno: 0,
        cha_sip_recid_recno: 0,
        cha_kirahar_recid_dbcno: 0,
        cha_kirahar_recid_recno: 0,
        cha_vardiya_tarihi: '1899-12-30 00:00:00.000',
        cha_vardiya_no: 0,
        cha_vardiya_evrak_ti: 0,
        cha_ebelge_cinsi: 0,
        cha_tevkifat_toplam: 0,
        cha_ilave_edilecek_kdv1: 0,
        cha_ilave_edilecek_kdv2: 0,
        cha_ilave_edilecek_kdv3: 0,
        cha_ilave_edilecek_kdv4: 0,
        cha_ilave_edilecek_kdv5: 0,
        cha_ilave_edilecek_kdv6: 0,
        cha_ilave_edilecek_kdv7: 0,
        cha_ilave_edilecek_kdv8: 0,
        cha_ilave_edilecek_kdv9: 0,
        cha_ilave_edilecek_kdv10: 0,
        cha_e_islem_turu: 0,
        cha_fatura_belge_turu: 0,
        cha_diger_belge_adi: '',
        cha_uuid: crypto.randomUUID().toUpperCase()
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

      // İade kontrolü
      const isIade = webSatis.satis_tipi === 'iade' || webSatis.fatura_tipi === 'iade' || webSatis.iade === true;

      return {
        sth_stok_kod: stokKod,
        sth_miktar: webKalem.miktar,
        sth_iskonto1: webKalem.iskonto1 || webKalem.indirim_tutari || 0,
        sth_iskonto2: webKalem.iskonto2 || webKalem.indirim_tutari2 || 0,
        sth_iskonto3: webKalem.iskonto3 || webKalem.indirim_tutari3 || 0,
        sth_iskonto4: webKalem.iskonto4 || webKalem.indirim_tutari4 || 0,
        sth_iskonto5: webKalem.iskonto5 || webKalem.indirim_tutari5 || 0,
        sth_iskonto6: webKalem.iskonto6 || webKalem.indirim_tutari6 || 0,
        sth_tutar: webKalem.toplam_tutar,
        sth_vergi: webKalem.kdv_tutari || 0,
        sth_vergi_pntr: 1, // Kullanıcı isteği: sth_vergi_pntr=1
        sth_tarih: webSatis.satis_tarihi,
        sth_belge_tarih: webSatis.satis_tarihi,
        sth_cari_kodu: cariKod,
        sth_cikis_depo_no: 1,
        sth_giris_depo_no: 1, // Kullanıcı isteği: sth_giris_depo_no=1
        sth_tip: isIade ? 1 : 1, // İade: 1 (Giriş), Normal: 1 (Çıkış) - Trace'e göre her ikisi de 1
        sth_cins: 0,
        sth_normal_iade: isIade ? 1 : 0,
        sth_evraktip: 4, // Kullanıcı isteği: sth_evraktip=4
        sth_evrakno_sira: webSatis.fatura_sira_no,
        sth_evrakno_seri: webSatis.fatura_seri_no || '',
        sth_malkbl_sevk_tarihi: formatDateOnlyForMSSQL(webSatis.satis_tarihi),
        sth_satirno: 0,
        sth_belge_no: '',
        sth_fis_tarihi: '1899-12-30 00:00:00.000',
        sth_create_date: formatDateTimeForMSSQL(new Date()),
        sth_lastup_date: formatDateTimeForMSSQL(new Date()),
        sth_special1: '',
        sth_special2: '',
        sth_special3: '',
        // Eksik alanlar - referans kaydından alınan değerler
        sth_isk_mas1: 0,
        sth_isk_mas2: 1,
        sth_isk_mas3: 1,
        sth_isk_mas4: 1,
        sth_isk_mas5: 1,
        sth_isk_mas6: 1,
        sth_isk_mas7: 1,
        sth_isk_mas8: 1,
        sth_isk_mas9: 1,
        sth_isk_mas10: 1,
        sth_sat_iskmas1: 0,
        sth_sat_iskmas2: 0,
        sth_sat_iskmas3: 0,
        sth_sat_iskmas4: 0,
        sth_sat_iskmas5: 0,
        sth_sat_iskmas6: 0,
        sth_sat_iskmas7: 0,
        sth_sat_iskmas8: 0,
        sth_sat_iskmas9: 0,
        sth_sat_iskmas10: 0,
        sth_pos_satis: 0,
        sth_promosyon_fl: 0,
        sth_cari_cinsi: 0,
        sth_cari_grup_no: 0,
        sth_isemri_gider_kodu: '',
        sth_plasiyer_kodu: '',
        sth_miktar2: 0,
        sth_birim_pntr: 1,
        sth_masraf1: 0,
        sth_masraf2: 0,
        sth_masraf3: 0,
        sth_masraf4: 0,
        sth_masraf_vergi_pntr: 0,
        sth_masraf_vergi: 0,
        sth_netagirlik: 0,
        sth_odeme_op: 0,
        sth_aciklama: '',
        sth_sip_recid_dbcno: 0,
        sth_sip_recid_recno: 0,
        sth_fat_recid_dbcno: 0,
        sth_cari_srm_merkezi: '',
        sth_stok_srm_merkezi: '',
        sth_fis_sirano: 0,
        sth_vergisiz_fl: 0,
        sth_maliyet_ana: 0,
        sth_maliyet_alternatif: 0,
        sth_maliyet_orjinal: 0,
        sth_adres_no: 1,
        sth_parti_kodu: '',
        sth_lot_no: 0,
        sth_kons_recid_dbcno: 0,
        sth_kons_recid_recno: 0,
        sth_proje_kodu: '',
        sth_exim_kodu: '',
        sth_otv_pntr: 0,
        sth_otv_vergi: 0,
        sth_brutagirlik: 0,
        sth_disticaret_turu: 0,
        sth_otvtutari: 0,
        sth_otvvergisiz_fl: 0,
        sth_oiv_pntr: 0,
        sth_oiv_vergi: 0,
        sth_oivvergisiz_fl: 0,
        sth_fiyat_liste_no: 1, // Kullanıcı isteği: sth_fiyat_liste_no=1
        sth_oivtutari: 0,
        sth_Tevkifat_turu: 0,
        sth_nakliyedeposu: 0,
        sth_nakliyedurumu: 0,
        sth_yetkili_recid_dbcno: 0,
        sth_yetkili_recid_recno: 0,
        sth_taxfree_fl: 0,
        sth_ilave_edilecek_kdv: 0
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
