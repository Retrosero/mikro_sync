
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const iadeTransformer = require('../transformers/iade.transformer');
const logger = require('../utils/logger');

class IadeProcessor {
  async process(recordData, operation) {
    if (operation === 'INSERT' || operation === 'UPDATE') {
      await this.syncToERP(recordData);
    }
  }

  async syncToERP(webIade) {
    try {
      // Mükerrer kayıt kontrolü (int_iade_mapping tablosundan)
      const existing = await pgService.query(
        'SELECT erp_evrak_seri, erp_evrak_no FROM int_iade_mapping WHERE web_iade_id = $1',
        [webIade.id]
      );

      if (existing.length > 0) {
        logger.warn(`Bu iade zaten ERP'ye aktarılmış: ${webIade.id}, Evrak: ${existing[0].erp_evrak_seri}-${existing[0].erp_evrak_no}`);
        return;
      }

      // İade kalemlerini çek
      const kalemler = await pgService.query(
        'SELECT * FROM iade_kalemleri WHERE iade_id = $1 ORDER BY sira_no',
        [webIade.id]
      );

      if (kalemler.length === 0) {
        logger.warn(`İade kalemleri bulunamadı: ${webIade.id}`);
        return;
      }

      // cari_hesap_hareketleri tablosundan hareket_turu, banka_kodu, kasa_kodu ve ERP alanlarını al
      let cariHareket = await pgService.query(
        `SELECT id, hareket_turu, banka_kodu, kasa_kodu, banka_id, kasa_id, cha_tpoz, cha_cari_cins, cha_grupno
         FROM cari_hesap_hareketleri 
         WHERE belge_no = $1 
         AND hareket_tipi = 'satis_iade'
         LIMIT 1`,
        [webIade.iade_no ? webIade.iade_no.toString() : '']
      );

      if (cariHareket.length === 0) {
        cariHareket = await pgService.query(
          `SELECT id, hareket_turu, banka_kodu, kasa_kodu, banka_id, kasa_id, cha_tpoz, cha_cari_cins, cha_grupno
           FROM cari_hesap_hareketleri 
           WHERE cari_hesap_id = $1 
           AND tutar = $2
           AND hareket_tipi = 'satis_iade'
           ORDER BY 
             (CASE WHEN banka_kodu IS NOT NULL OR kasa_kodu IS NOT NULL THEN 1 ELSE 0 END) DESC,
             guncelleme_tarihi DESC 
           LIMIT 1`,
          [webIade.cari_hesap_id, webIade.toplam_tutar]
        );
      }

      if (cariHareket.length > 0) {
        webIade.hareket_turu = cariHareket[0].hareket_turu;
        webIade.banka_kodu = cariHareket[0].banka_kodu;
        webIade.kasa_kodu = cariHareket[0].kasa_kodu;
        webIade.banka_id = cariHareket[0].banka_id;
        webIade.kasa_id = cariHareket[0].kasa_id;
        webIade.cha_tpoz = cariHareket[0].cha_tpoz;
        webIade.cha_cari_cins = cariHareket[0].cha_cari_cins;
        webIade.cha_grupno = cariHareket[0].cha_grupno;

        if (webIade.banka_id && !webIade.banka_kodu) {
          const bankaKayit = await pgService.query('SELECT ban_kod FROM bankalar WHERE id = $1', [webIade.banka_id]);
          if (bankaKayit.length > 0) webIade.banka_kodu = bankaKayit[0].ban_kod;
        }
      }

      const baslikData = await iadeTransformer.transformIadeBaslik(webIade);

      let evrakSeri, evrakNo, chaRecno;

      await mssqlService.transaction(async (transaction) => {
        if (!baslikData.cha_evrakno_sira) {
          const mappingMax = await pgService.query(
            'SELECT COALESCE(MAX(erp_evrak_no), 0) + 1 as max_no FROM int_iade_mapping WHERE erp_evrak_seri = $1',
            [baslikData.cha_evrakno_seri]
          );
          const request = transaction.request();
          request.input('evrak_tip', baslikData.cha_evrak_tip);
          request.input('evrakno_seri', baslikData.cha_evrakno_seri);

          const result = await request.query(`
            SELECT MAX(MaxNo) as yeni_evrak_no FROM (
                SELECT ISNULL(MAX(cha_evrakno_sira), 0) + 1 as MaxNo
                FROM CARI_HESAP_HAREKETLERI
                WHERE cha_evrak_tip = @evrak_tip AND cha_evrakno_seri = @evrakno_seri
                UNION ALL
                SELECT ISNULL(MAX(sth_evrakno_sira), 0) + 1 as MaxNo
                FROM STOK_HAREKETLERI
                WHERE sth_evraktip = @evrak_tip AND sth_evrakno_seri = @evrakno_seri
            ) as T
          `);
          const erpMax = result.recordset[0].yeni_evrak_no;
          const webMax = mappingMax[0].max_no;
          baslikData.cha_evrakno_sira = Math.max(erpMax, webMax);
          logger.info(`Yeni evrak numarası alındı: ${baslikData.cha_evrakno_sira}`);
        }
        evrakSeri = baslikData.cha_evrakno_seri;
        evrakNo = baslikData.cha_evrakno_sira;

        chaRecno = await this.insertCariHareket(baslikData, transaction);
        await mssqlService.updateRecIdRecNo('CARI_HESAP_HAREKETLERI', 'cha_RECno', chaRecno, transaction);

        let satirNo = 0;
        for (const kalem of kalemler) {
          const satirData = await iadeTransformer.transformIadeKalem(kalem, webIade);
          satirData.sth_evrakno_sira = evrakNo;
          satirData.sth_evrakno_seri = evrakSeri;
          satirData.sth_satirno = satirNo;
          const sthRecno = await this.insertStokHareket(satirData, chaRecno, transaction);
          await mssqlService.updateRecIdRecNo('STOK_HAREKETLERI', 'sth_RECno', sthRecno, transaction);
          satirNo++;
        }
        logger.info(`İade ERP'ye yazıldı: ${webIade.id}, EvrakNo: ${evrakNo}`);
      });

      await pgService.query(
        'INSERT INTO int_iade_mapping (web_iade_id, erp_evrak_seri, erp_evrak_no) VALUES ($1, $2, $3) ON CONFLICT (web_iade_id) DO NOTHING',
        [webIade.id, evrakSeri, evrakNo]
      );

      // ÖNEMLİ: ERP'ye gönderim sonrası, Web'deki orijinal kayıtları (erp_recno = NULL) sil
      // Böylece sadece ERP'den dönen (erp_recno değeri olan) kayıtlar kalır

      // 1. Cari hareket: iade_id ile eşleşen ve erp_recno'su NULL olan kayıtları sil
      const deletedCari = await pgService.query(`
        DELETE FROM cari_hesap_hareketleri 
        WHERE belge_no = $1 
        AND hareket_tipi = 'satis_iade'
        AND erp_recno IS NULL
      `, [webIade.id.toString()]);

      if (deletedCari.rowCount > 0) {
        logger.info(`✓ ${deletedCari.rowCount} adet orijinal cari hareket silindi (iade_id: ${webIade.id})`);
      }

      // 2. Stok hareketleri: iade_id ile eşleşen ve erp_recno'su NULL olan kayıtları sil
      const deletedStok = await pgService.query(`
        DELETE FROM stok_hareketleri 
        WHERE belge_no = $1 
        AND belge_tipi = 'iade'
        AND erp_recno IS NULL
      `, [webIade.id.toString()]);

      if (deletedStok.rowCount > 0) {
        logger.info(`✓ ${deletedStok.rowCount} adet orijinal stok hareket silindi (iade_id: ${webIade.id})`);
      }
    } catch (error) {
      logger.error('İade ERP senkronizasyon hatası:', error);
      throw error;
    }
  }

  async insertCariHareket(data, transaction) {
    const request = transaction.request();
    Object.keys(data).forEach(key => request.input(key, data[key]));

    const result = await request.query(`
      INSERT INTO CARI_HESAP_HAREKETLERI (
        cha_tarihi, cha_belge_tarih, cha_evrakno_sira, cha_evrakno_seri,
        cha_belge_no, cha_satir_no,
        cha_kod, cha_ciro_cari_kodu, cha_meblag, cha_aratoplam, cha_aciklama,
        cha_tpoz, cha_cari_cins, cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_Iade,
        cha_vade,
        cha_ft_iskonto1, cha_ft_iskonto2, cha_ft_iskonto3, 
        cha_ft_iskonto4, cha_ft_iskonto5, cha_ft_iskonto6,
        cha_d_cins, cha_d_kur, cha_altd_kur, cha_karsid_kur,
        cha_create_user, cha_lastup_user, cha_create_date, cha_lastup_date,
        cha_firmano, cha_subeno,
        cha_kasa_hizmet, cha_kasa_hizkod,
        cha_RECid_DBCno, cha_RECid_RECno, cha_SpecRecNo, cha_iptal, 
        cha_fileid, cha_hidden, cha_kilitli, cha_degisti, cha_CheckSum,
        cha_projekodu, cha_yat_tes_kodu, cha_satici_kodu, cha_EXIMkodu,
        cha_ticaret_turu, cha_grupno, cha_srmrkkodu, cha_karsidcinsi,
        cha_special1, cha_special2, cha_special3,
        cha_karsidgrupno, cha_karsisrmrkkodu, cha_miktari, cha_Vade_Farki_Yuz,
        cha_ft_masraf1, cha_ft_masraf2, cha_ft_masraf3, cha_ft_masraf4,
        cha_isk_mas1, cha_isk_mas2, cha_isk_mas3, cha_isk_mas4, cha_isk_mas5,
        cha_isk_mas6, cha_isk_mas7, cha_isk_mas8, cha_isk_mas9, cha_isk_mas10,
        cha_sat_iskmas1, cha_sat_iskmas2, cha_sat_iskmas3, cha_sat_iskmas4, cha_sat_iskmas5,
        cha_sat_iskmas6, cha_sat_iskmas7, cha_sat_iskmas8, cha_sat_iskmas9, cha_sat_iskmas10,
        cha_yuvarlama, cha_StFonPntr, cha_stopaj, cha_savsandesfonu, cha_avansmak_damgapul,
        cha_vergipntr, cha_vergi1, cha_vergi2, cha_vergi3, cha_vergi4,
        cha_vergi5, cha_vergi6, cha_vergi7, cha_vergi8, cha_vergi9, cha_vergi10,
        cha_vergisiz_fl, cha_otvtutari, cha_otvvergisiz_fl, cha_oiv_pntr, cha_oivtutari,
        cha_oiv_vergi, cha_oivergisiz_fl, cha_fis_tarih, cha_fis_sirano, cha_trefno,
        cha_sntck_poz, cha_reftarihi, cha_istisnakodu, cha_pos_hareketi,
        cha_meblag_ana_doviz_icin_gecersiz_fl, cha_meblag_alt_doviz_icin_gecersiz_fl, cha_meblag_orj_doviz_icin_gecersiz_fl,
        cha_sip_recid_dbcno, cha_sip_recid_recno, cha_kirahar_recid_dbcno, cha_kirahar_recid_recno,
        cha_vardiya_tarihi, cha_vardiya_no, cha_vardiya_evrak_ti, cha_ebelge_cinsi,
        cha_tevkifat_toplam, cha_ilave_edilecek_kdv1, cha_ilave_edilecek_kdv2, cha_ilave_edilecek_kdv3,
        cha_ilave_edilecek_kdv4, cha_ilave_edilecek_kdv5, cha_ilave_edilecek_kdv6, cha_ilave_edilecek_kdv7,
        cha_ilave_edilecek_kdv8, cha_ilave_edilecek_kdv9, cha_ilave_edilecek_kdv10,
        cha_e_islem_turu, cha_fatura_belge_turu, cha_diger_belge_adi, cha_uuid
      )
      VALUES (
        @cha_tarihi, @cha_belge_tarih, @cha_evrakno_sira, @cha_evrakno_seri,
        @cha_belge_no, @cha_satir_no,
        @cha_kod, @cha_ciro_cari_kodu, @cha_meblag, @cha_aratoplam, @cha_aciklama,
        @cha_tpoz, @cha_cari_cins, @cha_evrak_tip, @cha_tip, @cha_cinsi, @cha_normal_Iade,
        @cha_vade,
        @cha_ft_iskonto1, @cha_ft_iskonto2, @cha_ft_iskonto3,
        @cha_ft_iskonto4, @cha_ft_iskonto5, @cha_ft_iskonto6,
        @cha_d_cins, @cha_d_kur, @cha_altd_kur, @cha_karsid_kur,
        @cha_create_user, @cha_lastup_user, @cha_create_date, @cha_lastup_date,
        @cha_firmano, @cha_subeno,
        @cha_kasa_hizmet, @cha_kasa_hizkod,
        0, 0, 0, 0, 51, 0, 0, 0, 0,
        @cha_projekodu, @cha_yat_tes_kodu, @cha_satici_kodu, @cha_EXIMkodu,
        @cha_ticaret_turu, @cha_grupno, @cha_srmrkkodu, @cha_karsidcinsi,
        @cha_special1, @cha_special2, @cha_special3,
        @cha_karsidgrupno, @cha_karsisrmrkkodu, @cha_miktari, @cha_Vade_Farki_Yuz,
        @cha_ft_masraf1, @cha_ft_masraf2, @cha_ft_masraf3, @cha_ft_masraf4,
        @cha_isk_mas1, @cha_isk_mas2, @cha_isk_mas3, @cha_isk_mas4, @cha_isk_mas5,
        @cha_isk_mas6, @cha_isk_mas7, @cha_isk_mas8, @cha_isk_mas9, @cha_isk_mas10,
        @cha_sat_iskmas1, @cha_sat_iskmas2, @cha_sat_iskmas3, @cha_sat_iskmas4, @cha_sat_iskmas5,
        @cha_sat_iskmas6, @cha_sat_iskmas7, @cha_sat_iskmas8, @cha_sat_iskmas9, @cha_sat_iskmas10,
        @cha_yuvarlama, @cha_StFonPntr, @cha_stopaj, @cha_savsandesfonu, @cha_avansmak_damgapul,
        @cha_vergipntr, @cha_vergi1, @cha_vergi2, @cha_vergi3, @cha_vergi4,
        @cha_vergi5, @cha_vergi6, @cha_vergi7, @cha_vergi8, @cha_vergi9, @cha_vergi10,
        @cha_vergisiz_fl, @cha_otvtutari, @cha_otvvergisiz_fl, @cha_oiv_pntr, @cha_oivtutari,
        @cha_oiv_vergi, @cha_oivergisiz_fl, @cha_fis_tarih, @cha_fis_sirano, @cha_trefno,
        @cha_sntck_poz, @cha_reftarihi, @cha_istisnakodu, @cha_pos_hareketi,
        @cha_meblag_ana_doviz_icin_gecersiz_fl, @cha_meblag_alt_doviz_icin_gecersiz_fl, @cha_meblag_orj_doviz_icin_gecersiz_fl,
        @cha_sip_recid_dbcno, @cha_sip_recid_recno, @cha_kirahar_recid_dbcno, @cha_kirahar_recid_recno,
        @cha_vardiya_tarihi, @cha_vardiya_no, @cha_vardiya_evrak_ti, @cha_ebelge_cinsi,
        @cha_tevkifat_toplam, @cha_ilave_edilecek_kdv1, @cha_ilave_edilecek_kdv2, @cha_ilave_edilecek_kdv3,
        @cha_ilave_edilecek_kdv4, @cha_ilave_edilecek_kdv5, @cha_ilave_edilecek_kdv6, @cha_ilave_edilecek_kdv7,
        @cha_ilave_edilecek_kdv8, @cha_ilave_edilecek_kdv9, @cha_ilave_edilecek_kdv10,
        @cha_e_islem_turu, @cha_fatura_belge_turu, @cha_diger_belge_adi, @cha_uuid
      );
      SELECT SCOPE_IDENTITY() AS cha_RECno;
    `);

    return result.recordset[0].cha_RECno;
  }

  async insertStokHareket(data, chaRecno, transaction) {
    const request = transaction.request();
    Object.keys(data).forEach(key => request.input(key, data[key]));
    if (chaRecno) request.input('sth_fat_recid_recno', chaRecno);



    const result = await request.query(`
      INSERT INTO STOK_HAREKETLERI (
        sth_stok_kod, sth_miktar, sth_tutar, sth_vergi, sth_vergi_pntr,
        sth_iskonto1, sth_iskonto2, sth_iskonto3, sth_iskonto4, sth_iskonto5, sth_iskonto6,
        sth_tarih, sth_belge_tarih, sth_cari_kodu,
        sth_cikis_depo_no, sth_giris_depo_no,
        sth_tip, sth_cins, sth_normal_iade, sth_evraktip,
        sth_evrakno_sira, sth_evrakno_seri,
        sth_create_user, sth_lastup_user, sth_create_date, sth_lastup_date,
        sth_firmano, sth_subeno,
        sth_har_doviz_cinsi, sth_har_doviz_kuru, sth_alt_doviz_kuru,
        sth_stok_doviz_cinsi, sth_stok_doviz_kuru,
        sth_RECid_DBCno, sth_RECid_RECno, sth_SpecRECno, sth_iptal,
        sth_fileid, sth_hidden, sth_kilitli, sth_degisti, sth_checksum,
        sth_satirno, sth_belge_no, sth_fis_tarihi, sth_malkbl_sevk_tarihi,
        sth_special1, sth_special2, sth_special3,
        sth_isk_mas1, sth_isk_mas2, sth_isk_mas3, sth_isk_mas4, sth_isk_mas5,
        sth_isk_mas6, sth_isk_mas7, sth_isk_mas8, sth_isk_mas9, sth_isk_mas10,
        sth_sat_iskmas1, sth_sat_iskmas2, sth_sat_iskmas3, sth_sat_iskmas4, sth_sat_iskmas5,
        sth_sat_iskmas6, sth_sat_iskmas7, sth_sat_iskmas8, sth_sat_iskmas9, sth_sat_iskmas10,
        sth_pos_satis, sth_promosyon_fl, sth_cari_cinsi, sth_cari_grup_no,
        sth_isemri_gider_kodu, sth_plasiyer_kodu, sth_miktar2, sth_birim_pntr,
        sth_masraf1, sth_masraf2, sth_masraf3, sth_masraf4,
        sth_masraf_vergi_pntr, sth_masraf_vergi, sth_netagirlik, sth_odeme_op,
        sth_aciklama, sth_sip_recid_dbcno, sth_sip_recid_recno, sth_fat_recid_dbcno,
        sth_cari_srm_merkezi, sth_stok_srm_merkezi, sth_fis_sirano, sth_vergisiz_fl,
        sth_maliyet_ana, sth_maliyet_alternatif, sth_maliyet_orjinal, sth_adres_no,
        sth_parti_kodu, sth_lot_no, sth_kons_recid_dbcno, sth_kons_recid_recno,
        sth_proje_kodu, sth_exim_kodu, sth_otv_pntr, sth_otv_vergi,
        sth_brutagirlik, sth_disticaret_turu, sth_otvtutari, sth_otvvergisiz_fl,
        sth_oiv_pntr, sth_oiv_vergi, sth_oivvergisiz_fl, sth_fiyat_liste_no,
        sth_oivtutari, sth_Tevkifat_turu, sth_nakliyedeposu, sth_nakliyedurumu,
        sth_yetkili_recid_dbcno, sth_yetkili_recid_recno, sth_taxfree_fl, sth_ilave_edilecek_kdv
        ${chaRecno ? ', sth_fat_recid_recno' : ''}
      )
      VALUES (
        @sth_stok_kod, @sth_miktar, @sth_tutar, @sth_vergi, @sth_vergi_pntr,
        @sth_iskonto1, @sth_iskonto2, @sth_iskonto3, @sth_iskonto4, @sth_iskonto5, @sth_iskonto6,
        @sth_tarih, @sth_belge_tarih, @sth_cari_kodu,
        @sth_cikis_depo_no, @sth_giris_depo_no,
        @sth_tip, @sth_cins, @sth_normal_iade, @sth_evraktip,
        @sth_evrakno_sira, @sth_evrakno_seri,
        @sth_create_user, @sth_lastup_user, @sth_create_date, @sth_lastup_date,
        @sth_firmano, @sth_subeno,
        @sth_har_doviz_cinsi, @sth_har_doviz_kuru, @sth_alt_doviz_kuru,
        @sth_stok_doviz_cinsi, @sth_stok_doviz_kuru,
        0, 0, 0, 0, 16, 0, 0, 0, 0,
        @sth_satirno, @sth_belge_no, @sth_fis_tarihi, @sth_malkbl_sevk_tarihi,
        @sth_special1, @sth_special2, @sth_special3,
        @sth_isk_mas1, @sth_isk_mas2, @sth_isk_mas3, @sth_isk_mas4, @sth_isk_mas5,
        @sth_isk_mas6, @sth_isk_mas7, @sth_isk_mas8, @sth_isk_mas9, @sth_isk_mas10,
        @sth_sat_iskmas1, @sth_sat_iskmas2, @sth_sat_iskmas3, @sth_sat_iskmas4, @sth_sat_iskmas5,
        @sth_sat_iskmas6, @sth_sat_iskmas7, @sth_sat_iskmas8, @sth_sat_iskmas9, @sth_sat_iskmas10,
        @sth_pos_satis, @sth_promosyon_fl, @sth_cari_cinsi, @sth_cari_grup_no,
        @sth_isemri_gider_kodu, @sth_plasiyer_kodu, @sth_miktar2, @sth_birim_pntr,
        @sth_masraf1, @sth_masraf2, @sth_masraf3, @sth_masraf4,
        @sth_masraf_vergi_pntr, @sth_masraf_vergi, @sth_netagirlik, @sth_odeme_op,
        @sth_aciklama, @sth_sip_recid_dbcno, @sth_sip_recid_recno, @sth_fat_recid_dbcno,
        @sth_cari_srm_merkezi, @sth_stok_srm_merkezi, @sth_fis_sirano, @sth_vergisiz_fl,
        @sth_maliyet_ana, @sth_maliyet_alternatif, @sth_maliyet_orjinal, @sth_adres_no,
        @sth_parti_kodu, @sth_lot_no, @sth_kons_recid_dbcno, @sth_kons_recid_recno,
        @sth_proje_kodu, @sth_exim_kodu, @sth_otv_pntr, @sth_otv_vergi,
        @sth_brutagirlik, @sth_disticaret_turu, @sth_otvtutari, @sth_otvvergisiz_fl,
        @sth_oiv_pntr, @sth_oiv_vergi, @sth_oivvergisiz_fl, @sth_fiyat_liste_no,
        @sth_oivtutari, @sth_Tevkifat_turu, @sth_nakliyedeposu, @sth_nakliyedurumu,
        @sth_yetkili_recid_dbcno, @sth_yetkili_recid_recno, @sth_taxfree_fl, @sth_ilave_edilecek_kdv
        ${chaRecno ? ', @sth_fat_recid_recno' : ''}
      );
      SELECT SCOPE_IDENTITY() AS sth_RECno;
    `);

    return result.recordset[0].sth_RECno;
  }
}

module.exports = new IadeProcessor();
