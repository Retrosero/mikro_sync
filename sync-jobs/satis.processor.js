const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const satisTransformer = require('../transformers/satis.transformer');
const logger = require('../utils/logger');

class SatisProcessor {
  async process(recordData, operation) {
    if (operation === 'INSERT' || operation === 'UPDATE') {
      await this.syncToERP(recordData);
    }
  }

  async syncToERP(webSatis) {
    try {
      // DEBUG: Satislar tablosundan gelen değerleri göster
      logger.info(`syncToERP BAŞLIYOR: ID=${webSatis.id}, odeme_sekli=${webSatis.odeme_sekli}, banka_id=${webSatis.banka_id || 'YOK'}, kasa_id=${webSatis.kasa_id || 'YOK'}`);

      // Mükerrer kayıt kontrolü (int_satis_mapping tablosundan)
      const existing = await pgService.query(
        'SELECT erp_evrak_seri, erp_evrak_no FROM int_satis_mapping WHERE web_satis_id = $1',
        [webSatis.id]
      );

      if (existing.length > 0) {
        logger.warn(`Bu satış zaten ERP'ye aktarılmış: ${webSatis.id}, Evrak: ${existing[0].erp_evrak_seri}-${existing[0].erp_evrak_no}`);
        return;
      }

      // Satış kalemlerini çek
      const kalemler = await pgService.query(
        'SELECT * FROM satis_kalemleri WHERE satis_id = $1 ORDER BY sira_no',
        [webSatis.id]
      );

      if (kalemler.length === 0) {
        logger.warn(`Satış kalemleri bulunamadı: ${webSatis.id}`);
        return;
      }

      // cari_hesap_hareketleri tablosundan hareket_turu, banka_kodu, kasa_kodu ve ERP alanlarını al
      // 1. Önce kesin eşleşme (belge_no = satis_id) ile ara
      let cariHareket = await pgService.query(
        `SELECT id, hareket_turu, banka_kodu, kasa_kodu, banka_id, kasa_id, cha_tpoz, cha_cari_cins, cha_grupno
         FROM cari_hesap_hareketleri 
         WHERE belge_no = $1 
         AND hareket_tipi = 'Satış'
         LIMIT 1`,
        [webSatis.id.toString()]
      );

      // 2. Bulunamadıysa eski yöntemle (tutar + cari + son hareket) ara
      if (cariHareket.length === 0) {
        cariHareket = await pgService.query(
          `SELECT id, hareket_turu, banka_kodu, kasa_kodu, banka_id, kasa_id, cha_tpoz, cha_cari_cins, cha_grupno
           FROM cari_hesap_hareketleri 
           WHERE cari_hesap_id = $1 
           AND tutar = $2
           AND hareket_tipi = 'Satış'
           ORDER BY 
             (CASE WHEN banka_kodu IS NOT NULL OR kasa_kodu IS NOT NULL THEN 1 ELSE 0 END) DESC,
             guncelleme_tarihi DESC 
           LIMIT 1`,
          [webSatis.cari_hesap_id, webSatis.toplam_tutar]
        );
      }

      // Eğer cari_hesap_hareketleri'nde varsa, oradan al
      // ÖNEMLİ: satislar tablosundan gelen banka_id, kasa_id, banka_kodu, kasa_kodu değerlerini KORU!
      const originalBankaId = webSatis.banka_id;
      const originalKasaId = webSatis.kasa_id;
      const originalBankaKodu = webSatis.banka_kodu;
      const originalKasaKodu = webSatis.kasa_kodu;

      if (cariHareket.length > 0) {
        webSatis.hareket_turu = cariHareket[0].hareket_turu;

        // Kodları sadece satislar tablosunda yoksa cari_hesap_hareketleri'nden al
        if (!originalBankaKodu && cariHareket[0].banka_kodu) {
          webSatis.banka_kodu = cariHareket[0].banka_kodu;
        }
        if (!originalKasaKodu && cariHareket[0].kasa_kodu) {
          webSatis.kasa_kodu = cariHareket[0].kasa_kodu;
        }

        // ID'leri sadece satislar tablosunda yoksa al
        if (!originalBankaId && cariHareket[0].banka_id) {
          webSatis.banka_id = cariHareket[0].banka_id;
        }
        if (!originalKasaId && cariHareket[0].kasa_id) {
          webSatis.kasa_id = cariHareket[0].kasa_id;
        }

        webSatis.cha_tpoz = cariHareket[0].cha_tpoz;
        webSatis.cha_cari_cins = cariHareket[0].cha_cari_cins;
        webSatis.cha_grupno = cariHareket[0].cha_grupno;
        logger.info(`Cari hareket bulundu: tur=${cariHareket[0].hareket_turu}, banka=${webSatis.banka_kodu}, kasa=${webSatis.kasa_kodu}`);

        // Eğer banka_id var ama banka_kodu yoksa, bankalar tablosundan bul
        if (webSatis.banka_id && !webSatis.banka_kodu) {
          const bankaKayit = await pgService.query('SELECT ban_kod FROM bankalar WHERE id = $1', [webSatis.banka_id]);
          if (bankaKayit.length > 0) {
            webSatis.banka_kodu = bankaKayit[0].ban_kod;
            logger.info(`Banka tablosundan kod tamamlandı: ${webSatis.banka_kodu}`);
          }
        }
      } else {
        logger.warn(`Cari hareket bulunamadı: satis_id=${webSatis.id}, cari=${webSatis.cari_hesap_id}, tutar=${webSatis.toplam_tutar}`);

        // DÜZELTME: Cari hareket bulunamadıysa, satislar tablosundaki banka_id ve kasa_id'den kodları al
        // webSatis zaten satislar tablosundan gelen veri, banka_id ve kasa_id içermeli
        if (webSatis.banka_id) {
          const bankaKayit = await pgService.query('SELECT ban_kod FROM bankalar WHERE id = $1', [webSatis.banka_id]);
          if (bankaKayit.length > 0) {
            webSatis.banka_kodu = bankaKayit[0].ban_kod;
            logger.info(`Satış kaydından banka kodu alındı: banka_id=${webSatis.banka_id}, banka_kodu=${webSatis.banka_kodu}`);
          }
        }
        if (webSatis.kasa_id) {
          const kasaKayit = await pgService.query('SELECT kasa_kodu FROM kasalar WHERE id = $1', [webSatis.kasa_id]);
          if (kasaKayit.length > 0) {
            webSatis.kasa_kodu = kasaKayit[0].kasa_kodu;
            logger.info(`Satış kaydından kasa kodu alındı: kasa_id=${webSatis.kasa_id}, kasa_kodu=${webSatis.kasa_kodu}`);
          }
        }
      }

      // Transaction başlat
      let evrakSeri, evrakNo, chaRecno;

      // Başlık verilerini transaction öncesi hazırla (Web'e INSERT için gerekli)
      const baslikData = await satisTransformer.transformSatisBaslik(webSatis);

      await mssqlService.transaction(async (transaction) => {
        // ... (Transaction logic remains same)
        // 1. Başlık verileri zaten hazır

        // Sıra numarası kontrolü - her zaman yeni numara al
        if (!baslikData.cha_evrakno_sira) {
          // Önce mapping tablosundan en büyük numarayı al
          const mappingMax = await pgService.query(
            'SELECT COALESCE(MAX(erp_evrak_no), 0) + 1 as max_no FROM int_satis_mapping WHERE erp_evrak_seri = $1',
            [baslikData.cha_evrakno_seri]
          );

          // Son evrak numarasını al ve 1 artır
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

          // İki sonuçtan en büyüğünü al
          const erpMax = result.recordset[0].yeni_evrak_no;
          const webMax = mappingMax[0].max_no;
          baslikData.cha_evrakno_sira = Math.max(erpMax, webMax);

          logger.info(`Yeni evrak numarası alındı: ${baslikData.cha_evrakno_sira} (ERP: ${erpMax}, Web: ${webMax})`);
        }

        // Evrak bilgilerini kaydet
        evrakSeri = baslikData.cha_evrakno_seri;
        evrakNo = baslikData.cha_evrakno_sira;

        // 2. Cari hareket oluştur (her durumda - muhasebe programı için gerekli)
        chaRecno = await this.insertCariHareket(baslikData, transaction);

        // RECid_RECno güncelle
        await mssqlService.updateRecIdRecNo('CARI_HESAP_HAREKETLERI', 'cha_RECno', chaRecno, transaction);

        // 3. Satır verilerini yaz
        let satirNo = 0; // Satır numarası 0'dan başlayacak
        for (const kalem of kalemler) {
          const satirData = await satisTransformer.transformSatisKalem(kalem, webSatis);

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

        logger.info(`Satış ERP'ye yazıldı: ${webSatis.id}, EvrakNo: ${baslikData.cha_evrakno_sira}`);
      });

      // Mapping tablosuna kaydet
      await pgService.query(
        'INSERT INTO int_satis_mapping (web_satis_id, erp_evrak_seri, erp_evrak_no) VALUES ($1, $2, $3) ON CONFLICT (web_satis_id) DO NOTHING',
        [webSatis.id, evrakSeri, evrakNo]
      );

      // Eğer banka_id var ama banka_kodu yoksa, bankalar tablosundan bul (Tekrar kontrol)
      if (webSatis.banka_id && !webSatis.banka_kodu) {
        const bankaKayit = await pgService.query('SELECT ban_kod FROM bankalar WHERE id = $1', [webSatis.banka_id]);
        if (bankaKayit.length > 0) {
          webSatis.banka_kodu = bankaKayit[0].ban_kod;
        }
      }

      // Hareket türü düzeltmesi: Eğer banka_id varsa ve hareket türü Açık Hesap ise, Bankadan K. yap
      if (webSatis.banka_id && (webSatis.hareket_turu === 'Açık Hesap' || !webSatis.hareket_turu)) {
        webSatis.hareket_turu = 'Bankadan K.';
      }

      // Web'de de cari hareket kaydı oluştur (erp_recno ile)
      await pgService.query(`
        INSERT INTO cari_hesap_hareketleri (
          erp_recno, cha_recno, cari_hesap_id, islem_tarihi, belge_no, tutar, aciklama,
          fatura_seri_no, fatura_sira_no, hareket_tipi, hareket_turu, belge_tipi,
          onceki_bakiye, sonraki_bakiye, cha_tpoz, cha_cari_cins, cha_grupno, 
          banka_kodu, kasa_kodu, banka_id, kasa_id, guncelleme_tarihi
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
        ON CONFLICT (erp_recno) DO UPDATE SET
          cari_hesap_id = EXCLUDED.cari_hesap_id,
          tutar = EXCLUDED.tutar,
          cha_tpoz = EXCLUDED.cha_tpoz,
          cha_cari_cins = EXCLUDED.cha_cari_cins,
          cha_grupno = EXCLUDED.cha_grupno,
          banka_kodu = EXCLUDED.banka_kodu,
          kasa_kodu = EXCLUDED.kasa_kodu,
          banka_id = EXCLUDED.banka_id,
          kasa_id = EXCLUDED.kasa_id,
          hareket_turu = EXCLUDED.hareket_turu,
          guncelleme_tarihi = NOW()
      `, [
        chaRecno,
        chaRecno, // cha_recno alanına da aynı değer
        webSatis.cari_hesap_id,
        webSatis.satis_tarihi,
        evrakSeri + evrakNo,
        webSatis.toplam_tutar,
        webSatis.notlar || '',
        evrakSeri,
        evrakNo,
        'Satış',
        webSatis.hareket_turu || 'Açık Hesap',
        'fatura',
        0, // onceki_bakiye
        0, // sonraki_bakiye
        baslikData.cha_tpoz,
        baslikData.cha_cari_cins,
        baslikData.cha_grupno,
        webSatis.banka_kodu || null,
        webSatis.kasa_kodu || null,
        webSatis.banka_id || null,
        webSatis.kasa_id || null
      ]);

      // ÖNEMLİ: ERP'ye gönderim sonrası, Web'deki orijinal kayıtları (erp_recno = NULL) sil
      // Böylece sadece ERP'den dönen (erp_recno değeri olan) kayıtlar kalır
      // Bu sayede ERP'de silme yapıldığında, Web'de de doğru kayıt silinir

      // 1. Cari hareket: satis_id ile eşleşen ve erp_recno'su NULL olan kayıtları sil
      const deletedCari = await pgService.query(`
        DELETE FROM cari_hesap_hareketleri 
        WHERE belge_no = $1 
        AND hareket_tipi = 'Satış'
        AND erp_recno IS NULL
      `, [webSatis.id.toString()]);

      if (deletedCari.rowCount > 0) {
        logger.info(`✓ ${deletedCari.rowCount} adet orijinal cari hareket silindi (satis_id: ${webSatis.id})`);
      }

      // 2. Stok hareketleri: satis_id ile eşleşen ve erp_recno'su NULL olan kayıtları sil
      const deletedStok = await pgService.query(`
        DELETE FROM stok_hareketleri 
        WHERE belge_no = $1 
        AND belge_tipi = 'satis'
        AND erp_recno IS NULL
      `, [webSatis.id.toString()]);

      if (deletedStok.rowCount > 0) {
        logger.info(`✓ ${deletedStok.rowCount} adet orijinal stok hareket silindi (satis_id: ${webSatis.id})`);
      }

    } catch (error) {
      logger.error('Satış ERP senkronizasyon hatası:', error);
      throw error;
    }
  }

  async insertCariHareket(data, transaction) {
    const request = transaction.request();

    // Parametreleri ekle
    Object.keys(data).forEach(key => {
      request.input(key, data[key]);
    });

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
        cha_e_islem_turu, cha_fatura_belge_turu, cha_diger_belge_adi
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
        @cha_e_islem_turu, @cha_fatura_belge_turu, @cha_diger_belge_adi
      );
      SELECT SCOPE_IDENTITY() AS cha_RECno;
    `);

    return result.recordset[0].cha_RECno;
  }

  async insertStokHareket(data, chaRecno, transaction) {
    const request = transaction.request();

    // Parametreleri ekle
    // Parametreleri ekle
    Object.keys(data).forEach(key => {
      request.input(key, data[key]);
    });

    if (chaRecno) {
      request.input('sth_fat_recid_recno', chaRecno);
    }

    // Default değerler
    request.input('sth_create_user', 1);
    request.input('sth_lastup_user', 1);
    request.input('sth_firmano', 0);
    request.input('sth_subeno', 0);
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

module.exports = new SatisProcessor();
