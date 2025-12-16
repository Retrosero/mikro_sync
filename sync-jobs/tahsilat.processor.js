const mssqlService = require('../services/mssql.service');
const tahsilatTransformer = require('../transformers/tahsilat.transformer');
const logger = require('../utils/logger');

class TahsilatProcessor {
  async process(recordData, operation) {
    if (operation === 'INSERT' || operation === 'UPDATE') {
      await this.syncToERP(recordData);
    }
  }

  async syncToERP(webTahsilat) {
    try {
      await mssqlService.transaction(async (transaction) => {
        let odemeEmriRefno = null;

        // Çek/Senet/Havale/Kredi Kartı ise önce ODEME_EMIRLERI kaydını oluştur
        if (['cek', 'senet', 'havale', 'kredi_karti'].includes(webTahsilat.tahsilat_tipi)) {
          const odemeEmriData = await tahsilatTransformer.transformOdemeEmri(webTahsilat);
          if (odemeEmriData) {
            odemeEmriRefno = odemeEmriData.sck_refno;
            const sckRecno = await this.insertOdemeEmri(odemeEmriData, transaction);
            await mssqlService.updateRecIdRecNo('ODEME_EMIRLERI', 'sck_RECno', sckRecno, transaction);

            logger.info(`Ödeme Emri ERP'ye yazıldı: ${webTahsilat.id}, Refno: ${odemeEmriRefno}, RecNo: ${sckRecno}`);
          }
        }

        // Tahsilat verilerini hazırla (odemeEmriRefno ile)
        const tahsilatData = await tahsilatTransformer.transformTahsilat(webTahsilat, odemeEmriRefno);

        // Sıra numarası kontrolü
        if (!tahsilatData.cha_evrakno_sira) {
          tahsilatData.cha_evrakno_sira = await mssqlService.getNextEvrakNo(tahsilatData.cha_evrak_tip, tahsilatData.cha_evrakno_seri);
        }

        // CARI_HESAP_HAREKETLERI kaydını oluştur
        const chaRecno = await this.insertCariHareket(tahsilatData, transaction);
        await mssqlService.updateRecIdRecNo('CARI_HESAP_HAREKETLERI', 'cha_RECno', chaRecno, transaction);

        logger.info(`Tahsilat ERP'ye yazıldı: ${webTahsilat.id}, EvrakNo: ${tahsilatData.cha_evrakno_sira}, RecNo: ${chaRecno}`);
      });
    } catch (error) {
      logger.error('Tahsilat ERP senkronizasyon hatası:', error);
      throw error;
    }
  }

  async insertCariHareket(data, transaction) {
    const request = transaction.request();

    Object.keys(data).forEach(key => {
      request.input(key, data[key]);
    });

    // Şu anki tarih-saat
    const now = new Date();
    request.input('cha_create_date', now);
    request.input('cha_lastup_date', now);

    const result = await request.query(`
      INSERT INTO CARI_HESAP_HAREKETLERI (
        cha_tarihi, cha_belge_tarih, cha_kod, cha_meblag, cha_aratoplam,
        cha_aciklama, cha_tpoz, cha_cari_cins, cha_evrak_tip,
        cha_tip, cha_cinsi, cha_normal_Iade,
        cha_evrakno_sira, cha_evrakno_seri, cha_vade,
        cha_d_cins, cha_d_kur, cha_altd_kur, cha_karsid_kur,
        cha_create_user, cha_lastup_user, cha_firmano, cha_subeno,
        cha_kasa_hizmet, cha_kasa_hizkod,
        cha_ciro_cari_kodu, cha_grupno, cha_karsidgrupno,
        cha_trefno, cha_sntck_poz,
        cha_create_date, cha_lastup_date,
        cha_RECid_DBCno, cha_RECid_RECno, cha_SpecRecNo, cha_iptal, 
        cha_fileid, cha_hidden, cha_kilitli, cha_degisti, cha_CheckSum,
        cha_projekodu, cha_yat_tes_kodu, cha_satici_kodu, cha_EXIMkodu,
        cha_satir_no, cha_ticaret_turu, cha_belge_no, cha_srmrkkodu,
        cha_karsidcinsi, cha_karsisrmrkkodu, cha_miktari,
        cha_Vade_Farki_Yuz,
        cha_ft_iskonto1, cha_ft_iskonto2, cha_ft_iskonto3, cha_ft_iskonto4, cha_ft_iskonto5, cha_ft_iskonto6,
        cha_ft_masraf1, cha_ft_masraf2, cha_ft_masraf3, cha_ft_masraf4,
        cha_isk_mas1, cha_isk_mas2, cha_isk_mas3, cha_isk_mas4, cha_isk_mas5,
        cha_isk_mas6, cha_isk_mas7, cha_isk_mas8, cha_isk_mas9, cha_isk_mas10,
        cha_sat_iskmas1, cha_sat_iskmas2, cha_sat_iskmas3, cha_sat_iskmas4, cha_sat_iskmas5,
        cha_sat_iskmas6, cha_sat_iskmas7, cha_sat_iskmas8, cha_sat_iskmas9, cha_sat_iskmas10,
        cha_yuvarlama, cha_StFonPntr, cha_stopaj, cha_savsandesfonu,
        cha_avansmak_damgapul, cha_vergipntr,
        cha_vergi1, cha_vergi2, cha_vergi3, cha_vergi4, cha_vergi5,
        cha_vergi6, cha_vergi7, cha_vergi8, cha_vergi9, cha_vergi10,
        cha_vergisiz_fl, cha_otvtutari, cha_otvvergisiz_fl,
        cha_oiv_pntr, cha_oivtutari, cha_oiv_vergi, cha_oivergisiz_fl,
        cha_fis_tarih, cha_fis_sirano, cha_reftarihi,
        cha_istisnakodu, cha_pos_hareketi,
        cha_meblag_ana_doviz_icin_gecersiz_fl, cha_meblag_alt_doviz_icin_gecersiz_fl, cha_meblag_orj_doviz_icin_gecersiz_fl,
        cha_sip_recid_dbcno, cha_sip_recid_recno, cha_kirahar_recid_dbcno, cha_kirahar_recid_recno,
        cha_vardiya_tarihi, cha_vardiya_no, cha_vardiya_evrak_ti,
        cha_ebelge_cinsi, cha_tevkifat_toplam,
        cha_ilave_edilecek_kdv1, cha_ilave_edilecek_kdv2, cha_ilave_edilecek_kdv3, cha_ilave_edilecek_kdv4, cha_ilave_edilecek_kdv5,
        cha_ilave_edilecek_kdv6, cha_ilave_edilecek_kdv7, cha_ilave_edilecek_kdv8, cha_ilave_edilecek_kdv9, cha_ilave_edilecek_kdv10,
        cha_e_islem_turu, cha_fatura_belge_turu, cha_diger_belge_adi, cha_uuid,
        cha_special1, cha_special2, cha_special3
      )
      VALUES (
        @cha_tarihi, @cha_belge_tarih, @cha_kod, @cha_meblag, @cha_aratoplam,
        @cha_aciklama, @cha_tpoz, @cha_cari_cins, @cha_evrak_tip,
        @cha_tip, @cha_cinsi, @cha_normal_Iade,
        @cha_evrakno_sira, @cha_evrakno_seri, @cha_vade,
        @cha_d_cins, @cha_d_kur, @cha_altd_kur, @cha_karsid_kur,
        @cha_create_user, @cha_lastup_user, @cha_firmano, @cha_subeno,
        @cha_kasa_hizmet, @cha_kasa_hizkod,
        @cha_ciro_cari_kodu, @cha_grupno, @cha_karsidgrupno,
        @cha_trefno, @cha_sntck_poz,
        @cha_create_date, @cha_lastup_date,
        0, 0, 0, 0, 51, 0, 0, 0, 0,
        @cha_projekodu, @cha_yat_tes_kodu, @cha_satici_kodu, @cha_EXIMkodu,
        @cha_satir_no, @cha_ticaret_turu, @cha_belge_no, @cha_srmrkkodu,
        @cha_karsidcinsi, @cha_karsisrmrkkodu, @cha_miktari,
        @cha_Vade_Farki_Yuz,
        @cha_ft_iskonto1, @cha_ft_iskonto2, @cha_ft_iskonto3, @cha_ft_iskonto4, @cha_ft_iskonto5, @cha_ft_iskonto6,
        @cha_ft_masraf1, @cha_ft_masraf2, @cha_ft_masraf3, @cha_ft_masraf4,
        @cha_isk_mas1, @cha_isk_mas2, @cha_isk_mas3, @cha_isk_mas4, @cha_isk_mas5,
        @cha_isk_mas6, @cha_isk_mas7, @cha_isk_mas8, @cha_isk_mas9, @cha_isk_mas10,
        @cha_sat_iskmas1, @cha_sat_iskmas2, @cha_sat_iskmas3, @cha_sat_iskmas4, @cha_sat_iskmas5,
        @cha_sat_iskmas6, @cha_sat_iskmas7, @cha_sat_iskmas8, @cha_sat_iskmas9, @cha_sat_iskmas10,
        @cha_yuvarlama, @cha_StFonPntr, @cha_stopaj, @cha_savsandesfonu,
        @cha_avansmak_damgapul, @cha_vergipntr,
        @cha_vergi1, @cha_vergi2, @cha_vergi3, @cha_vergi4, @cha_vergi5,
        @cha_vergi6, @cha_vergi7, @cha_vergi8, @cha_vergi9, @cha_vergi10,
        @cha_vergisiz_fl, @cha_otvtutari, @cha_otvvergisiz_fl,
        @cha_oiv_pntr, @cha_oivtutari, @cha_oiv_vergi, @cha_oivergisiz_fl,
        @cha_fis_tarih, @cha_fis_sirano, @cha_reftarihi,
        @cha_istisnakodu, @cha_pos_hareketi,
        @cha_meblag_ana_doviz_icin_gecersiz_fl, @cha_meblag_alt_doviz_icin_gecersiz_fl, @cha_meblag_orj_doviz_icin_gecersiz_fl,
        @cha_sip_recid_dbcno, @cha_sip_recid_recno, @cha_kirahar_recid_dbcno, @cha_kirahar_recid_recno,
        @cha_vardiya_tarihi, @cha_vardiya_no, @cha_vardiya_evrak_ti,
        @cha_ebelge_cinsi, @cha_tevkifat_toplam,
        @cha_ilave_edilecek_kdv1, @cha_ilave_edilecek_kdv2, @cha_ilave_edilecek_kdv3, @cha_ilave_edilecek_kdv4, @cha_ilave_edilecek_kdv5,
        @cha_ilave_edilecek_kdv6, @cha_ilave_edilecek_kdv7, @cha_ilave_edilecek_kdv8, @cha_ilave_edilecek_kdv9, @cha_ilave_edilecek_kdv10,
        @cha_e_islem_turu, @cha_fatura_belge_turu, @cha_diger_belge_adi, @cha_uuid,
        @cha_special1, @cha_special2, @cha_special3
      );
      SELECT SCOPE_IDENTITY() AS cha_RECno;
    `);

    return result.recordset[0].cha_RECno;
  }

  async insertOdemeEmri(data, transaction) {
    const request = transaction.request();

    Object.keys(data).forEach(key => {
      request.input(key, data[key]);
    });

    // Default değerler
    request.input('sck_create_user', 1);
    request.input('sck_lastup_user', 1);
    request.input('sck_firmano', 0);
    request.input('sck_subeno', 0);

    // Şu anki tarih-saat
    const now = new Date();
    request.input('sck_create_date', now);
    request.input('sck_lastup_date', now);

    const result = await request.query(`
      INSERT INTO ODEME_EMIRLERI (
        sck_tip, sck_refno, sck_bankano, sck_borclu, sck_vdaire_no, sck_vade,
        sck_tutar, sck_doviz, sck_odenen, sck_degerleme_islendi,
        sck_banka_adres1, sck_sube_adres2, sck_borclu_tel, sck_hesapno_sehir,
        sck_no, sck_duzen_tarih, sck_sahip_cari_kodu,
        sck_iptal, sck_sahip_cari_cins, sck_sahip_cari_grupno,
        sck_nerede_cari_cins, sck_nerede_cari_kodu, sck_nerede_cari_grupno,
        sck_create_user, sck_lastup_user, sck_firmano, sck_subeno,
        sck_create_date, sck_lastup_date,
        sck_RECid_DBCno, sck_RECid_RECno, sck_SpecRECno,
        sck_fileid, sck_hidden, sck_kilitli, sck_degisti, sck_checksum
      )
      VALUES (
        @sck_tip, @sck_refno, '', @sck_borclu, @sck_vdaire_no, @sck_vade,
        @sck_tutar, @sck_doviz, @sck_odenen, @sck_degerleme_islendi,
        @sck_banka_adres1, @sck_sube_adres2, @sck_borclu_tel, @sck_hesapno_sehir,
        @sck_no, @sck_duzen_tarih, @sck_sahip_cari_kodu,
        @sck_iptal, 0, 0,
        0, '', 0,
        @sck_create_user, @sck_lastup_user, @sck_firmano, @sck_subeno,
        @sck_create_date, @sck_lastup_date,
        0, 0, 0,
        54, 0, 0, 0, 0
      );
      SELECT SCOPE_IDENTITY() AS sck_RECno;
    `);

    return result.recordset[0].sck_RECno;
  }
}

module.exports = new TahsilatProcessor();
