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
      // Satış kalemlerini çek
      const kalemler = await pgService.query(
        'SELECT * FROM satis_kalemleri WHERE satis_id = $1 ORDER BY sira_no',
        [webSatis.id]
      );

      if (kalemler.length === 0) {
        logger.warn(`Satış kalemleri bulunamadı: ${webSatis.id}`);
        return;
      }

      // Transaction başlat
      await mssqlService.transaction(async (transaction) => {
        // 1. Başlık verilerini hazırla
        const baslikData = await satisTransformer.transformSatisBaslik(webSatis);

        // Sıra numarası kontrolü
        if (!baslikData.cha_evrakno_sira) {
          baslikData.cha_evrakno_sira = await mssqlService.getNextEvrakNo(baslikData.cha_evrak_tip, baslikData.cha_evrakno_seri);
        }

        // 2. Sadece veresiye satışlarda başlık yaz
        let chaRecno = null;
        if (webSatis.odeme_sekli === 'veresiye' || webSatis.odeme_sekli === 'acikhesap') {
          // CARI_HESAP_HAREKETLERI'ne ekle
          chaRecno = await this.insertCariHareket(baslikData, transaction);

          // RECid_RECno güncelle
          await mssqlService.updateRecIdRecNo('CARI_HESAP_HAREKETLERI', 'cha_RECno', chaRecno, transaction);
        }

        // 3. Satır verilerini yaz
        for (const kalem of kalemler) {
          const satirData = await satisTransformer.transformSatisKalem(kalem, webSatis);

          // Başlıktaki evrak numarasını kullan
          satirData.sth_evrakno_sira = baslikData.cha_evrakno_sira;
          satirData.sth_evrakno_seri = baslikData.cha_evrakno_seri;

          // STOK_HAREKETLERI'ne ekle
          const sthRecno = await this.insertStokHareket(satirData, chaRecno, transaction);

          // RECid_RECno güncelle
          await mssqlService.updateRecIdRecNo('STOK_HAREKETLERI', 'sth_RECno', sthRecno, transaction);
        }

        logger.info(`Satış ERP'ye yazıldı: ${webSatis.id}, EvrakNo: ${baslikData.cha_evrakno_sira}`);
      });
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
        cha_kod, cha_meblag, cha_aratoplam, cha_aciklama,
        cha_tpoz, cha_cari_cins, cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_Iade,
        cha_vade,
        cha_ft_iskonto1, cha_ft_iskonto2, cha_ft_iskonto3, 
        cha_ft_iskonto4, cha_ft_iskonto5, cha_ft_iskonto6,
        cha_d_cins, cha_d_kur, cha_altd_kur, cha_karsid_kur,
        cha_create_user, cha_lastup_user, cha_firmano, cha_subeno,
        cha_kasa_hizmet, cha_kasa_hizkod,
        cha_RECid_DBCno, cha_RECid_RECno, cha_SpecRecNo, cha_iptal, 
        cha_fileid, cha_hidden, cha_kilitli, cha_degisti, cha_CheckSum,
        cha_projekodu, cha_yat_tes_kodu, cha_satici_kodu, cha_EXIMkodu
      )
      VALUES (
        @cha_tarihi, @cha_belge_tarih, @cha_evrakno_sira, @cha_evrakno_seri,
        @cha_kod, @cha_meblag, @cha_aratoplam, @cha_aciklama,
        @cha_tpoz, @cha_cari_cins, @cha_evrak_tip, @cha_tip, @cha_cinsi, @cha_normal_Iade,
        0,
        @cha_ft_iskonto1, @cha_ft_iskonto2, @cha_ft_iskonto3,
        @cha_ft_iskonto4, @cha_ft_iskonto5, @cha_ft_iskonto6,
        @cha_d_cins, @cha_d_kur, @cha_altd_kur, @cha_karsid_kur,
        @cha_create_user, @cha_lastup_user, @cha_firmano, @cha_subeno,
        @cha_kasa_hizmet, @cha_kasa_hizkod,
        0, 0, 0, 0, 51, 0, 0, 0, 0,
        '', '', '', ''
      );
      SELECT SCOPE_IDENTITY() AS cha_RECno;
    `);

    return result.recordset[0].cha_RECno;
  }

  async insertStokHareket(data, chaRecno, transaction) {
    const request = transaction.request();

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
        sth_create_user, sth_lastup_user, sth_firmano, sth_subeno,
        sth_har_doviz_cinsi, sth_har_doviz_kuru, sth_alt_doviz_kuru,
        sth_stok_doviz_cinsi, sth_stok_doviz_kuru,
        sth_RECid_DBCno, sth_RECid_RECno, sth_SpecRECno, sth_iptal,
        sth_fileid, sth_hidden, sth_kilitli, sth_degisti, sth_checksum
        ${chaRecno ? ', sth_fat_recid_recno' : ''}
      )
      VALUES (
        @sth_stok_kod, @sth_miktar, @sth_tutar, @sth_vergi, @sth_vergi_pntr,
        @sth_iskonto1, @sth_iskonto2, @sth_iskonto3, @sth_iskonto4, @sth_iskonto5, @sth_iskonto6,
        @sth_tarih, @sth_belge_tarih, @sth_cari_kodu,
        @sth_cikis_depo_no, @sth_giris_depo_no,
        @sth_tip, @sth_cins, @sth_normal_iade, @sth_evraktip,
        @sth_evrakno_sira, @sth_evrakno_seri,
        @sth_create_user, @sth_lastup_user, @sth_firmano, @sth_subeno,
        @sth_har_doviz_cinsi, @sth_har_doviz_kuru, @sth_alt_doviz_kuru,
        @sth_stok_doviz_cinsi, @sth_stok_doviz_kuru,
        0, 0, 0, 0, 16, 0, 0, 0, 0
        ${chaRecno ? ', @sth_fat_recid_recno' : ''}
      );
      SELECT SCOPE_IDENTITY() AS sth_RECno;
    `);

    return result.recordset[0].sth_RECno;
  }
}

module.exports = new SatisProcessor();
