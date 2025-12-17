const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const alisTransformer = require('../transformers/alis.transformer');
const logger = require('../utils/logger');

class AlisProcessor {
    async process(recordData, operation) {
        if (operation === 'INSERT' || operation === 'UPDATE') {
            await this.syncToERP(recordData);
        }
    }

    async syncToERP(webAlis) {
        try {
            // Mükerrer kayıt kontrolü (int_alis_mapping tablosundan)
            const existing = await pgService.query(
                'SELECT erp_evrak_seri, erp_evrak_no FROM int_alis_mapping WHERE web_alis_id = $1',
                [webAlis.id]
            );

            if (existing.length > 0) {
                logger.warn(`Bu alış zaten ERP'ye aktarılmış: ${webAlis.id}, Evrak: ${existing[0].erp_evrak_seri}-${existing[0].erp_evrak_no}`);
                return;
            }

            // Alış kalemlerini çek (alis_kalemleri tablosundan)
            const kalemler = await pgService.query(
                'SELECT * FROM alis_kalemleri WHERE alis_id = $1 ORDER BY sira_no',
                [webAlis.id]
            );

            if (kalemler.length === 0) {
                logger.warn(`Alış kalemleri bulunamadı: ${webAlis.id}`);
                return;
            }

            // Transaction başlat
            let evrakSeri, evrakNo, chaRecno;

            // Başlık verilerini transaction öncesi hazırla
            const baslikData = await alisTransformer.transformAlisBaslik(webAlis);

            await mssqlService.transaction(async (transaction) => {
                // Sıra numarası kontrolü - her zaman yeni numara al
                if (!baslikData.cha_evrakno_sira) {
                    // Önce mapping tablosundan en büyük numarayı al
                    const mappingMax = await pgService.query(
                        'SELECT COALESCE(MAX(erp_evrak_no), 0) + 1 as max_no FROM int_alis_mapping WHERE erp_evrak_seri = $1',
                        [baslikData.cha_evrakno_seri]
                    );

                    // Son evrak numarasını al ve 1 artır
                    const request = transaction.request();
                    request.input('evrak_tip', baslikData.cha_evrak_tip); // 0 (Alış)
                    request.input('evrakno_seri', baslikData.cha_evrakno_seri);

                    const result = await request.query(`
            SELECT MAX(MaxNo) as yeni_evrak_no FROM (
                SELECT ISNULL(MAX(cha_evrakno_sira), 0) + 1 as MaxNo
                FROM CARI_HESAP_HAREKETLERI
                WHERE cha_evrak_tip = @evrak_tip AND cha_evrakno_seri = @evrakno_seri
                UNION ALL
                SELECT ISNULL(MAX(sth_evrakno_sira), 0) + 1 as MaxNo
                FROM STOK_HAREKETLERI
                WHERE sth_evraktip = 3 AND sth_evrakno_seri = @evrakno_seri 
            ) as T
          `);
                    // Not: sth_evraktip Alış için 3 (Trace analizinden) ama cha_evrak_tip 0.
                    // Bu yüzden parametre olarak değil, doğrudan 3 yazdık veya query de sth_evraktip mappingine dikkat etmeliyiz.
                    // SatisProcessor'da @evrak_tip kullanılmıştı, ama orada Satis=63 idi.
                    // Burada Alış: Cha=0, Sth=3. Bu yüzden yukarıdaki UNION sorgusunda sth_evraktip = 3 dedik.

                    // İki sonuçtan en büyüğünü al
                    const erpMax = result.recordset[0].yeni_evrak_no;
                    const webMax = mappingMax[0].max_no;
                    baslikData.cha_evrakno_sira = Math.max(erpMax, webMax);

                    logger.info(`Yeni alış evrak numarası alındı: ${baslikData.cha_evrakno_sira} (ERP: ${erpMax}, Web: ${webMax})`);
                }

                // Evrak bilgilerini kaydet
                evrakSeri = baslikData.cha_evrakno_seri;
                evrakNo = baslikData.cha_evrakno_sira;

                // 2. Cari hareket oluştur
                chaRecno = await this.insertCariHareket(baslikData, transaction);

                // RECid_RECno güncelle
                await mssqlService.updateRecIdRecNo('CARI_HESAP_HAREKETLERI', 'cha_RECno', chaRecno, transaction);

                // 3. Satır verilerini yaz
                let satirNo = 0;
                for (const kalem of kalemler) {
                    const satirData = await alisTransformer.transformAlisKalem(kalem, webAlis);

                    // Başlıktaki evrak numarasını kullan
                    satirData.sth_evrakno_sira = baslikData.cha_evrakno_sira;
                    satirData.sth_evrakno_seri = baslikData.cha_evrakno_seri;

                    // Satır numarasını ayarla
                    satirData.sth_satirno = satirNo;

                    // STOK_HAREKETLERI'ne ekle
                    const sthRecno = await this.insertStokHareket(satirData, chaRecno, transaction);

                    // RECid_RECno güncelle
                    await mssqlService.updateRecIdRecNo('STOK_HAREKETLERI', 'sth_RECno', sthRecno, transaction);

                    // Satır numarasını artır
                    satirNo++;
                }

                logger.info(`Alış ERP'ye yazıldı: ${webAlis.id}, EvrakNo: ${baslikData.cha_evrakno_sira}`);
            });

            // Mapping tablosuna kaydet
            await pgService.query(
                'INSERT INTO int_alis_mapping (web_alis_id, erp_evrak_seri, erp_evrak_no) VALUES ($1, $2, $3) ON CONFLICT (web_alis_id) DO NOTHING',
                [webAlis.id, evrakSeri, evrakNo]
            );

            // Web cari_hesap_hareketleri'ne kayıt atma işlemi burada opsiyonel olabilir,
            // çünkü zaten webAlis tetikleyicisi ile bu sürece girdik. 
            // Ancak "Cari Hesap Hareketleri" tablosunda görünmesi isteniyorsa eklenebilir. 
            // Burada bu adımı atlıyorum çünkü kullanıcı özellikle istemedi ve karışıklık yaratabilir.
            // SatisProcessor'da vardı, burada ihtiyaç olursa eklenir.

        } catch (error) {
            logger.error('Alış ERP senkronizasyon hatası:', error);
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
        cha_vade, cha_ft_iskonto1, cha_ft_iskonto2, cha_ft_iskonto3, 
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
        cha_yuvarlama, cha_StFonPntr, cha_stopaj, cha_savsandesfonu, cha_avansmak_damgapul,
        cha_vergipntr, cha_vergisiz_fl, cha_otvtutari, cha_oiv_pntr, cha_oivtutari,
        cha_fis_tarih, cha_fis_sirano, cha_trefno,
        cha_sntck_poz, cha_reftarihi, cha_istisnakodu, cha_pos_hareketi,
        cha_meblag_ana_doviz_icin_gecersiz_fl, cha_meblag_alt_doviz_icin_gecersiz_fl, cha_meblag_orj_doviz_icin_gecersiz_fl,
        cha_sip_recid_dbcno, cha_sip_recid_recno, cha_kirahar_recid_dbcno, cha_kirahar_recid_recno,
        cha_vardiya_tarihi, cha_vardiya_no, cha_vardiya_evrak_ti, cha_ebelge_cinsi,
        cha_tevkifat_toplam, cha_e_islem_turu, cha_fatura_belge_turu, cha_diger_belge_adi, cha_uuid
      )
      VALUES (
        @cha_tarihi, @cha_belge_tarih, @cha_evrakno_sira, @cha_evrakno_seri,
        @cha_belge_no, @cha_satir_no,
        @cha_kod, @cha_ciro_cari_kodu, @cha_meblag, @cha_aratoplam, @cha_aciklama,
        @cha_tpoz, @cha_cari_cins, @cha_evrak_tip, @cha_tip, @cha_cinsi, @cha_normal_Iade,
        @cha_vade, @cha_ft_iskonto1, @cha_ft_iskonto2, @cha_ft_iskonto3,
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
        @cha_yuvarlama, @cha_StFonPntr, @cha_stopaj, @cha_savsandesfonu, @cha_avansmak_damgapul,
        @cha_vergipntr, @cha_vergisiz_fl, @cha_otvtutari, @cha_oiv_pntr, @cha_oivtutari,
        @cha_fis_tarih, @cha_fis_sirano, @cha_trefno,
        @cha_sntck_poz, @cha_reftarihi, @cha_istisnakodu, @cha_pos_hareketi,
        @cha_meblag_ana_doviz_icin_gecersiz_fl, @cha_meblag_alt_doviz_icin_gecersiz_fl, @cha_meblag_orj_doviz_icin_gecersiz_fl,
        @cha_sip_recid_dbcno, @cha_sip_recid_recno, @cha_kirahar_recid_dbcno, @cha_kirahar_recid_recno,
        @cha_vardiya_tarihi, @cha_vardiya_no, @cha_vardiya_evrak_ti, @cha_ebelge_cinsi,
        @cha_tevkifat_toplam, @cha_e_islem_turu, @cha_fatura_belge_turu, @cha_diger_belge_adi, @cha_uuid
      );
      SELECT SCOPE_IDENTITY() AS cha_RECno;
    `);

        return result.recordset[0].cha_RECno;
    }

    async insertStokHareket(data, chaRecno, transaction) {
        const request = transaction.request();
        Object.keys(data).forEach(key => request.input(key, data[key]));

        if (chaRecno) {
            request.input('sth_fat_recid_recno', chaRecno);
        }

        // Defaultlar
        request.input('sth_har_doviz_cinsi', 0);
        request.input('sth_har_doviz_kuru', 1);
        request.input('sth_alt_doviz_kuru', 1);
        request.input('sth_stok_doviz_cinsi', 0);
        request.input('sth_stok_doviz_kuru', 1);

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
        sth_pos_satis, sth_promosyon_fl, sth_cari_cinsi, sth_cari_grup_no,
        sth_isemri_gider_kodu, sth_plasiyer_kodu, sth_miktar2, sth_birim_pntr,
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
        '', '', '',
        @sth_pos_satis, @sth_promosyon_fl, @sth_cari_cinsi, 0,
        @sth_isemri_gider_kodu, @sth_plasiyer_kodu, @sth_miktar2, @sth_birim_pntr,
        0, 0, @sth_brutagirlik, 0,
        '', 0, 0, 0,
        '', '', 0, @sth_vergisiz_fl,
        @sth_maliyet_ana, @sth_maliyet_alternatif, @sth_maliyet_orjinal, @sth_adres_no,
        @sth_parti_kodu, @sth_lot_no, 0, 0,
        @sth_proje_kodu, @sth_exim_kodu, @sth_otv_pntr, @sth_otv_vergi,
        @sth_brutagirlik, @sth_disticaret_turu, @sth_otvtutari, @sth_otvvergisiz_fl,
        @sth_oiv_pntr, @sth_oiv_vergi, @sth_oivvergisiz_fl, @sth_fiyat_liste_no,
        @sth_oivtutari, @sth_Tevkifat_turu, @sth_nakliyedeposu, @sth_nakliyedurumu,
        0, 0, @sth_taxfree_fl, @sth_ilave_edilecek_kdv
        ${chaRecno ? ', @sth_fat_recid_recno' : ''}
      );
      SELECT SCOPE_IDENTITY() AS sth_RECno;
    `);

        return result.recordset[0].sth_RECno;
    }
}

module.exports = new AlisProcessor();
