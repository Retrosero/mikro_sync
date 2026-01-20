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
            const rawKalemler = await pgService.query(
                'SELECT * FROM alis_kalemleri WHERE alis_id = $1 ORDER BY sira_no',
                [webAlis.id]
            );

            if (rawKalemler.length === 0) {
                logger.warn(`Alış kalemleri bulunamadı: ${webAlis.id}`);
                return;
            }

            // Asorti ürünleri grupla
            const kalemler = await this.groupAsortiKalemler(rawKalemler);

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

            // ÖNEMLİ: ERP'ye gönderim sonrası, Web'deki orijinal kayıtları (erp_recno = NULL) sil
            // Böylece sadece ERP'den dönen (erp_recno değeri olan) kayıtlar kalır

            // 1. Cari hareket: alis_id ile eşleşen ve erp_recno'su NULL olan kayıtları sil
            const deletedCari = await pgService.query(`
                DELETE FROM cari_hesap_hareketleri 
                WHERE belge_no = $1 
                AND hareket_tipi = 'Alış'
                AND erp_recno IS NULL
            `, [webAlis.id.toString()]);

            if (deletedCari.rowCount > 0) {
                logger.info(`✓ ${deletedCari.rowCount} adet orijinal cari hareket silindi (alis_id: ${webAlis.id})`);
            }

            // 2. Stok hareketleri: alis_id ile eşleşen ve erp_recno'su NULL olan kayıtları sil
            const deletedStok = await pgService.query(`
                DELETE FROM stok_hareketleri 
                WHERE belge_no = $1 
                AND belge_tipi = 'alis'
                AND erp_recno IS NULL
            `, [webAlis.id.toString()]);

            if (deletedStok.rowCount > 0) {
                logger.info(`✓ ${deletedStok.rowCount} adet orijinal stok hareket silindi (alis_id: ${webAlis.id})`);
            }

        } catch (error) {
            logger.error('Alış ERP senkronizasyon hatası:', error);
            throw error;
        }
    }

    async insertCariHareket(data, transaction) {
        const request = transaction.request();
        Object.keys(data).forEach(key => request.input(key, data[key]));

        // NULL olan alanları 0 ile doldur
        request.input('cha_ft_masraf1', 0);
        request.input('cha_ft_masraf2', 0);
        request.input('cha_ft_masraf3', 0);
        request.input('cha_ft_masraf4', 0);
        request.input('cha_isk_mas1', 0);
        request.input('cha_isk_mas2', 0);
        request.input('cha_isk_mas3', 0);
        request.input('cha_isk_mas4', 0);
        request.input('cha_isk_mas5', 0);
        request.input('cha_isk_mas6', 0);
        request.input('cha_isk_mas7', 0);
        request.input('cha_isk_mas8', 0);
        request.input('cha_isk_mas9', 0);
        request.input('cha_isk_mas10', 0);
        request.input('cha_sat_iskmas1', 0);
        request.input('cha_sat_iskmas2', 0);
        request.input('cha_sat_iskmas3', 0);
        request.input('cha_sat_iskmas4', 0);
        request.input('cha_sat_iskmas5', 0);
        request.input('cha_sat_iskmas6', 0);
        request.input('cha_sat_iskmas7', 0);
        request.input('cha_sat_iskmas8', 0);
        request.input('cha_sat_iskmas9', 0);
        request.input('cha_sat_iskmas10', 0);
        request.input('cha_vergi1', 0);
        request.input('cha_vergi2', 0);
        request.input('cha_vergi3', 0);
        request.input('cha_vergi4', 0);
        request.input('cha_vergi5', 0);
        request.input('cha_vergi6', 0);
        request.input('cha_vergi7', 0);
        request.input('cha_vergi8', 0);
        request.input('cha_vergi9', 0);
        request.input('cha_vergi10', 0);
        request.input('cha_ilave_edilecek_kdv1', 0);
        request.input('cha_ilave_edilecek_kdv2', 0);
        request.input('cha_ilave_edilecek_kdv3', 0);
        request.input('cha_ilave_edilecek_kdv4', 0);
        request.input('cha_ilave_edilecek_kdv5', 0);
        request.input('cha_ilave_edilecek_kdv6', 0);
        request.input('cha_ilave_edilecek_kdv7', 0);
        request.input('cha_ilave_edilecek_kdv8', 0);
        request.input('cha_ilave_edilecek_kdv9', 0);
        request.input('cha_ilave_edilecek_kdv10', 0);
        request.input('cha_oiv_vergi', 0);
        request.input('cha_otvvergisiz_fl', 0);
        request.input('cha_oivergisiz_fl', 0);


        const result = await request.query(`
      INSERT INTO CARI_HESAP_HAREKETLERI (
        cha_tarihi, cha_belge_tarih, cha_evrakno_sira, cha_evrakno_seri,
        cha_belge_no, cha_satir_no,
        cha_kod, cha_ciro_cari_kodu, cha_meblag, cha_aratoplam, cha_aciklama,
        cha_tpoz, cha_cari_cins, cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_Iade,
        cha_vade, cha_ft_iskonto1, cha_ft_iskonto2, cha_ft_iskonto3, 
        cha_ft_iskonto4, cha_ft_iskonto5, cha_ft_iskonto6,
        cha_ft_masraf1, cha_ft_masraf2, cha_ft_masraf3, cha_ft_masraf4,
        cha_isk_mas1, cha_isk_mas2, cha_isk_mas3, cha_isk_mas4, cha_isk_mas5,
        cha_isk_mas6, cha_isk_mas7, cha_isk_mas8, cha_isk_mas9, cha_isk_mas10,
        cha_sat_iskmas1, cha_sat_iskmas2, cha_sat_iskmas3, cha_sat_iskmas4, cha_sat_iskmas5,
        cha_sat_iskmas6, cha_sat_iskmas7, cha_sat_iskmas8, cha_sat_iskmas9, cha_sat_iskmas10,
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
        cha_vergipntr, cha_vergi1, cha_vergi2, cha_vergi3, cha_vergi4, cha_vergi5,
        cha_vergi6, cha_vergi7, cha_vergi8, cha_vergi9, cha_vergi10,
        cha_vergisiz_fl, cha_otvtutari, cha_otvvergisiz_fl, cha_oiv_pntr, cha_oivtutari, cha_oiv_vergi, cha_oivergisiz_fl,
        cha_fis_tarih, cha_fis_sirano, cha_trefno,
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
        @cha_vade, @cha_ft_iskonto1, @cha_ft_iskonto2, @cha_ft_iskonto3,
        @cha_ft_iskonto4, @cha_ft_iskonto5, @cha_ft_iskonto6,
        @cha_ft_masraf1, @cha_ft_masraf2, @cha_ft_masraf3, @cha_ft_masraf4,
        @cha_isk_mas1, @cha_isk_mas2, @cha_isk_mas3, @cha_isk_mas4, @cha_isk_mas5,
        @cha_isk_mas6, @cha_isk_mas7, @cha_isk_mas8, @cha_isk_mas9, @cha_isk_mas10,
        @cha_sat_iskmas1, @cha_sat_iskmas2, @cha_sat_iskmas3, @cha_sat_iskmas4, @cha_sat_iskmas5,
        @cha_sat_iskmas6, @cha_sat_iskmas7, @cha_sat_iskmas8, @cha_sat_iskmas9, @cha_sat_iskmas10,
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
        @cha_vergipntr, @cha_vergi1, @cha_vergi2, @cha_vergi3, @cha_vergi4, @cha_vergi5,
        @cha_vergi6, @cha_vergi7, @cha_vergi8, @cha_vergi9, @cha_vergi10,
        @cha_vergisiz_fl, @cha_otvtutari, @cha_otvvergisiz_fl, @cha_oiv_pntr, @cha_oivtutari, @cha_oiv_vergi, @cha_oivergisiz_fl,
        @cha_fis_tarih, @cha_fis_sirano, @cha_trefno,
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

        if (chaRecno) {
            request.input('sth_fat_recid_recno', chaRecno);
        }

        // Defaultlar
        request.input('sth_har_doviz_cinsi', 0);
        request.input('sth_har_doviz_kuru', 1);
        request.input('sth_alt_doviz_kuru', 1);
        request.input('sth_stok_doviz_cinsi', 0);
        request.input('sth_stok_doviz_kuru', 1);

        // İskonto masraf alanları - Kullanıcı isteği: sth_isk_mas1=0, diğerleri=1
        request.input('sth_isk_mas1', 0);
        request.input('sth_isk_mas2', 1);
        request.input('sth_isk_mas3', 1);
        request.input('sth_isk_mas4', 1);
        request.input('sth_isk_mas5', 1);
        request.input('sth_isk_mas6', 1);
        request.input('sth_isk_mas7', 1);
        request.input('sth_isk_mas8', 1);
        request.input('sth_isk_mas9', 1);
        request.input('sth_isk_mas10', 1);
        request.input('sth_sat_iskmas1', 0);
        request.input('sth_sat_iskmas2', 0);
        request.input('sth_sat_iskmas3', 0);
        request.input('sth_sat_iskmas4', 0);
        request.input('sth_sat_iskmas5', 0);
        request.input('sth_sat_iskmas6', 0);
        request.input('sth_sat_iskmas7', 0);
        request.input('sth_sat_iskmas8', 0);
        request.input('sth_sat_iskmas9', 0);
        request.input('sth_sat_iskmas10', 0);
        request.input('sth_masraf1', 0);
        request.input('sth_masraf2', 0);
        request.input('sth_masraf3', 0);
        request.input('sth_masraf4', 0);

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
        sth_isk_mas1, sth_isk_mas2, sth_isk_mas3, sth_isk_mas4, sth_isk_mas5,
        sth_isk_mas6, sth_isk_mas7, sth_isk_mas8, sth_isk_mas9, sth_isk_mas10,
        sth_sat_iskmas1, sth_sat_iskmas2, sth_sat_iskmas3, sth_sat_iskmas4, sth_sat_iskmas5,
        sth_sat_iskmas6, sth_sat_iskmas7, sth_sat_iskmas8, sth_sat_iskmas9, sth_sat_iskmas10,
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
        '', '', '',
        @sth_pos_satis, @sth_promosyon_fl, @sth_cari_cinsi, 0,
        @sth_isemri_gider_kodu, @sth_plasiyer_kodu, @sth_miktar2, @sth_birim_pntr,
        @sth_isk_mas1, @sth_isk_mas2, @sth_isk_mas3, @sth_isk_mas4, @sth_isk_mas5,
        @sth_isk_mas6, @sth_isk_mas7, @sth_isk_mas8, @sth_isk_mas9, @sth_isk_mas10,
        @sth_sat_iskmas1, @sth_sat_iskmas2, @sth_sat_iskmas3, @sth_sat_iskmas4, @sth_sat_iskmas5,
        @sth_sat_iskmas6, @sth_sat_iskmas7, @sth_sat_iskmas8, @sth_sat_iskmas9, @sth_sat_iskmas10,
        @sth_masraf1, @sth_masraf2, @sth_masraf3, @sth_masraf4,
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

    async groupAsortiKalemler(kalemler) {
        const groupedItems = {}; // effective_stok_id -> combined_kalem

        for (const kalem of kalemler) {
            const stokInfo = await pgService.queryOne(
                'SELECT id, is_asorti, ana_stok_id FROM stoklar WHERE id = $1',
                [kalem.stok_id]
            );

            let effectiveStokId = kalem.stok_id;
            if (stokInfo && stokInfo.is_asorti && stokInfo.ana_stok_id) {
                effectiveStokId = stokInfo.ana_stok_id;
            }

            if (!groupedItems[effectiveStokId]) {
                groupedItems[effectiveStokId] = {
                    ...kalem,
                    stok_id: effectiveStokId,
                    miktar: 0,
                    toplam_tutar: 0,
                    kdv_tutari: 0,
                    indirim_tutari: 0,
                    iskonto1: 0, iskonto2: 0, iskonto3: 0, iskonto4: 0, iskonto5: 0, iskonto6: 0
                };
            }

            const group = groupedItems[effectiveStokId];
            group.miktar = parseFloat(group.miktar) + parseFloat(kalem.miktar);
            group.toplam_tutar = parseFloat(group.toplam_tutar) + parseFloat(kalem.toplam_tutar || 0);
            group.kdv_tutari = parseFloat(group.kdv_tutari) + parseFloat(kalem.kdv_tutari || 0);
            group.indirim_tutari = parseFloat(group.indirim_tutari) + parseFloat(kalem.indirim_tutari || 0);
        }

        return Object.values(groupedItems).map(item => ({
            ...item,
            miktar: parseFloat(item.miktar.toFixed(4)),
            toplam_tutar: parseFloat(item.toplam_tutar.toFixed(2)),
            kdv_tutari: parseFloat(item.kdv_tutari.toFixed(2)),
            indirim_tutari: parseFloat(item.indirim_tutari.toFixed(2))
        }));
    }
}

module.exports = new AlisProcessor();
