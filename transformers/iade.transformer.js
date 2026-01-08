
const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');
const crypto = require('crypto');
const pgService = require('../services/postgresql.service');

// Tarih dönüşüm fonksiyonları
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

function formatDateOnlyForMSSQL(date) {
  if (!date) return '1899-12-30 00:00:00.000';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} 00:00:00.000`;
}

class IadeTransformer {
  async transformIadeBaslik(webIade) {
    try {
      const cariKod = await lookupTables.getCariKod(webIade.cari_hesap_id);

      // Kullanıcı İsteği: Alış iade her zaman açık hesap (0) olsun.
      // Trace referans: cha_tpoz=0, cha_cari_cins=0
      let chaTpoz = 0;
      let chaCariCins = 0;
      let chaGrupno = 0;
      let chaKod = cariKod;
      let chaCiroCariKodu = cariKod;

      const islemTarihi = webIade.iade_tarihi || new Date();

      return {
        cha_firmano: 0,
        cha_subeno: 0,
        cha_evrak_tip: 0,
        cha_evrakno_seri: webIade.fatura_seri_no || '',
        cha_evrakno_sira: parseInt(webIade.fatura_sira_no || 0),
        cha_satir_no: 0,
        cha_tarihi: formatDateOnlyForMSSQL(islemTarihi),
        cha_tip: 1,
        cha_cinsi: 6,
        cha_normal_Iade: 1,
        cha_tpoz: chaTpoz,
        cha_ticaret_turu: 0,
        cha_belge_no: webIade.iade_no || '',
        cha_belge_tarih: formatDateOnlyForMSSQL(islemTarihi),
        cha_aciklama: webIade.notlar || '',
        cha_cari_cins: chaCariCins,
        cha_kod: chaKod,
        cha_ciro_cari_kodu: chaCiroCariKodu,
        cha_d_cins: 0,
        cha_d_kur: 1,
        cha_altd_kur: 1,
        cha_karsid_kur: 1,
        cha_create_user: 2,
        cha_create_date: formatDateTimeForMSSQL(webIade.olusturma_tarihi || new Date()),
        cha_lastup_user: 2,
        cha_lastup_date: formatDateTimeForMSSQL(webIade.guncelleme_tarihi || new Date()),
        cha_uuid: crypto.randomUUID().toUpperCase(),
        cha_grupno: chaGrupno,

        // Eksik Alanlar (Temizlenmiş - Duplicate Yok)
        cha_satici_kodu: '',
        cha_EXIMkodu: '',
        cha_projekodu: '',
        cha_yat_tes_kodu: '',
        cha_karsidcinsi: 0,
        cha_karsidgrupno: 0,
        cha_karsisrmrkkodu: '',
        cha_srmrkkodu: '',
        cha_kasa_hizmet: 0,
        cha_kasa_hizkod: '',
        cha_miktari: 0,
        cha_meblag: webIade.toplam_tutar,
        cha_aratoplam: webIade.ara_toplam || 0,
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

        cha_ft_iskonto1: 0,
        cha_ft_iskonto2: 0,
        cha_ft_iskonto3: 0,
        cha_ft_iskonto4: 0,
        cha_ft_iskonto5: 0,
        cha_ft_iskonto6: 0,

        cha_special1: '',
        cha_special2: '',
        cha_special3: '',
      };

    } catch (error) {
      logger.error('İade başlık transform hatası:', error);
      throw error;
    }
  }

  async transformIadeKalem(webKalem, webIade) {
    try {
      const stokKod = await lookupTables.getStokKod(webKalem.stok_id);
      const cariKod = await lookupTables.getCariKod(webIade.cari_hesap_id);
      const islemTarihi = webIade.iade_tarihi || new Date();

      return {
        sth_firmano: 0,
        sth_subeno: 0,
        sth_tarih: formatDateOnlyForMSSQL(islemTarihi),
        sth_tip: 0,
        sth_cins: 0,
        sth_normal_iade: 1,
        sth_evraktip: 3,
        sth_evrakno_seri: webIade.fatura_seri_no || '',
        sth_evrakno_sira: parseInt(webIade.fatura_sira_no || 0),
        sth_satirno: webKalem.sira_no || 0,
        sth_belge_no: webIade.iade_no || '',
        sth_belge_tarih: formatDateOnlyForMSSQL(islemTarihi),
        sth_stok_kod: stokKod || 'TANIMSIZ_STOK',
        sth_cari_kodu: cariKod,
        sth_miktar: webKalem.miktar,
        sth_tutar: webKalem.toplam_tutar,
        sth_vergi: webKalem.kdv_tutari || 0,
        sth_vergi_pntr: 1,
        sth_giris_depo_no: 1,
        sth_cikis_depo_no: 1,
        sth_malkbl_sevk_tarihi: formatDateOnlyForMSSQL(islemTarihi),
        sth_fis_tarihi: '1899-12-30 00:00:00.000',
        sth_create_user: 2,
        sth_lastup_user: 2,
        sth_create_date: formatDateTimeForMSSQL(webIade.olusturma_tarihi || new Date()),
        sth_lastup_date: formatDateTimeForMSSQL(webIade.guncelleme_tarihi || new Date()),

        sth_iskonto1: 0,
        sth_iskonto2: 0,
        sth_iskonto3: 0,
        sth_iskonto4: 0,
        sth_iskonto5: 0,
        sth_iskonto6: 0,
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
        sth_fis_tarih: '1899-12-30 00:00:00.000',
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
        sth_fiyat_liste_no: 1,
        sth_oivtutari: 0,
        sth_Tevkifat_turu: 0,
        sth_nakliyedeposu: 0,
        sth_nakliyedurumu: 0,
        sth_yetkili_recid_dbcno: 0,
        sth_yetkili_recid_recno: 0,
        sth_taxfree_fl: 0,
        sth_ilave_edilecek_kdv: 0,
        sth_har_doviz_cinsi: 0,
        sth_har_doviz_kuru: 1,
        sth_alt_doviz_kuru: 1,
        sth_stok_doviz_cinsi: 0,
        sth_stok_doviz_kuru: 1,
        sth_special1: '',
        sth_special2: '',
        sth_special3: '',
      };

    } catch (error) {
      logger.error('İade kalem transform hatası:', error);
      throw error;
    }
  }
}

module.exports = new IadeTransformer();
