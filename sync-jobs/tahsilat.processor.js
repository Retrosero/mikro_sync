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
        // 1. Tahsilat verilerini hazırla
        const tahsilatData = await tahsilatTransformer.transformTahsilat(webTahsilat);

        // Sıra numarası kontrolü
        if (!tahsilatData.cha_evrakno_sira) {
          tahsilatData.cha_evrakno_sira = await mssqlService.getNextEvrakNo(tahsilatData.cha_evrak_tip, tahsilatData.cha_evrakno_seri);
        }

        // Çek/Senet ise önce ODEME_EMIRLERI, sonra CARI_HESAP_HAREKETLERI (Trace sırası)
        if (webTahsilat.tahsilat_tipi === 'cek' || webTahsilat.tahsilat_tipi === 'senet') {
          const odemeEmriData = await tahsilatTransformer.transformOdemeEmri(webTahsilat);
          if (odemeEmriData) {
            const sckRecno = await this.insertOdemeEmri(odemeEmriData, transaction);
            await mssqlService.updateRecIdRecNo('ODEME_EMIRLERI', 'sck_RECno', sckRecno, transaction);
          }

          // Sonra Cari Hareket
          const chaRecno = await this.insertCariHareket(tahsilatData, transaction);
          await mssqlService.updateRecIdRecNo('CARI_HESAP_HAREKETLERI', 'cha_RECno', chaRecno, transaction);

        } else {
          // Nakit/Kredi Kartı ise sadece Cari Hareket (veya önce Cari Hareket)
          const chaRecno = await this.insertCariHareket(tahsilatData, transaction);
          await mssqlService.updateRecIdRecNo('CARI_HESAP_HAREKETLERI', 'cha_RECno', chaRecno, transaction);
        }

        logger.info(`Tahsilat ERP'ye yazıldı: ${webTahsilat.id}, EvrakNo: ${tahsilatData.cha_evrakno_sira}`);
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

    const result = await request.query(`
      INSERT INTO CARI_HESAP_HAREKETLERI (
        cha_tarihi, cha_belge_tarih, cha_kod, cha_meblag, cha_aratoplam,
        cha_aciklama, cha_tpoz, cha_cari_cins, cha_evrak_tip,
        cha_tip, cha_cinsi, cha_normal_Iade,
        cha_evrakno_sira, cha_evrakno_seri, cha_vade,
        cha_d_cins, cha_d_kur, cha_altd_kur, cha_karsid_kur,
        cha_create_user, cha_lastup_user, cha_firmano, cha_subeno,
        cha_kasa_hizmet, cha_kasa_hizkod,
        cha_RECid_DBCno, cha_RECid_RECno, cha_SpecRecNo, cha_iptal, 
        cha_fileid, cha_hidden, cha_kilitli, cha_degisti, cha_CheckSum,
        cha_projekodu, cha_yat_tes_kodu, cha_satici_kodu, cha_EXIMkodu
      )
      VALUES (
        @cha_tarihi, @cha_belge_tarih, @cha_kod, @cha_meblag, @cha_aratoplam,
        @cha_aciklama, @cha_tpoz, @cha_cari_cins, @cha_evrak_tip,
        @cha_tip, @cha_cinsi, @cha_normal_Iade,
        @cha_evrakno_sira, @cha_evrakno_seri, @cha_vade,
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

    const result = await request.query(`
      INSERT INTO ODEME_EMIRLERI (
        sck_no, sck_banka_adres1, sck_sube_adres2, sck_hesapno_sehir,
        sck_tutar, sck_vade, sck_duzen_tarih, sck_sahip_cari_kodu,
        sck_tip, sck_doviz, sck_odenen, sck_iptal, sck_refno,
        sck_create_user, sck_lastup_user, sck_firmano, sck_subeno,
        sck_RECid_DBCno, sck_RECid_RECno, sck_SpecRECno,
        sck_fileid, sck_hidden, sck_kilitli, sck_degisti, sck_checksum
      )
      VALUES (
        @sck_no, @sck_banka_adres1, @sck_sube_adres2, @sck_hesapno_sehir,
        @sck_tutar, @sck_vade, @sck_duzen_tarih, @sck_sahip_cari_kodu,
        @sck_tip, @sck_doviz, @sck_odenen, @sck_iptal, @sck_refno,
        @sck_create_user, @sck_lastup_user, @sck_firmano, @sck_subeno,
        0, 0, 0, 0, 54, 0, 0, 0, 0
      );
      SELECT SCOPE_IDENTITY() AS sck_RECno;
    `);

    return result.recordset[0].sck_RECno;
  }
}

module.exports = new TahsilatProcessor();
