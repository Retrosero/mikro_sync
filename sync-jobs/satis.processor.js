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

        // 2. Sadece veresiye satışlarda başlık yaz
        let chaRecno = null;
        if (webSatis.odeme_sekli === 'veresiye' || webSatis.odeme_sekli === 'acikhesap') {
          // CARI_HESAP_HAREKETLERI'ne ekle
          const baslikResult = await this.insertCariHareket(baslikData, transaction);
          chaRecno = baslikResult;
        }

        // 3. Satır verilerini yaz
        for (const kalem of kalemler) {
          const satirData = await satisTransformer.transformSatisKalem(kalem, webSatis);
          
          // STOK_HAREKETLERI'ne ekle
          await this.insertStokHareket(satirData, chaRecno, transaction);
        }

        logger.info(`Satış ERP'ye yazıldı: ${webSatis.id}`);
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
        cha_tpoz, cha_cari_cins, cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_iade,
        cha_ft_iskonto1, cha_ft_iskonto2, cha_ft_iskonto3, 
        cha_ft_iskonto4, cha_ft_iskonto5, cha_ft_iskonto6
      )
      OUTPUT INSERTED.cha_RECno
      VALUES (
        @cha_tarihi, @cha_belge_tarih, @cha_evrakno_sira, @cha_evrakno_seri,
        @cha_kod, @cha_meblag, @cha_aratoplam, @cha_aciklama,
        @cha_tpoz, @cha_cari_cins, @cha_evrak_tip, @cha_tip, @cha_cinsi, @cha_normal_iade,
        @cha_ft_iskonto1, @cha_ft_iskonto2, @cha_ft_iskonto3,
        @cha_ft_iskonto4, @cha_ft_iskonto5, @cha_ft_iskonto6
      )
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

    await request.query(`
      INSERT INTO STOK_HAREKETLERI (
        sth_stok_kod, sth_miktar, sth_tutar, sth_vergi, sth_vergi_pntr,
        sth_iskonto1, sth_iskonto2, sth_iskonto3, sth_iskonto4, sth_iskonto5, sth_iskonto6,
        sth_tarih, sth_belge_tarih, sth_cari_kodu,
        sth_cikis_depo_no, sth_giris_depo_no,
        sth_tip, sth_cins, sth_normal_iade, sth_evraktip,
        sth_evrakno_sira, sth_evrakno_seri
        ${chaRecno ? ', sth_fat_recid_recno' : ''}
      )
      VALUES (
        @sth_stok_kod, @sth_miktar, @sth_tutar, @sth_vergi, @sth_vergi_pntr,
        @sth_iskonto1, @sth_iskonto2, @sth_iskonto3, @sth_iskonto4, @sth_iskonto5, @sth_iskonto6,
        @sth_tarih, @sth_belge_tarih, @sth_cari_kodu,
        @sth_cikis_depo_no, @sth_giris_depo_no,
        @sth_tip, @sth_cins, @sth_normal_iade, @sth_evraktip,
        @sth_evrakno_sira, @sth_evrakno_seri
        ${chaRecno ? ', @sth_fat_recid_recno' : ''}
      )
    `);
  }
}

module.exports = new SatisProcessor();
