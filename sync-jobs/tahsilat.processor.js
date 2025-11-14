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

        // 2. CARI_HESAP_HAREKETLERI'ne ekle
        await this.insertCariHareket(tahsilatData, transaction);

        // 3. Çek/Senet ise ODEME_EMIRLERI'ne de ekle
        if (webTahsilat.tahsilat_tipi === 'cek' || webTahsilat.tahsilat_tipi === 'senet') {
          const odemeEmriData = await tahsilatTransformer.transformOdemeEmri(webTahsilat);
          if (odemeEmriData) {
            await this.insertOdemeEmri(odemeEmriData, transaction);
          }
        }

        logger.info(`Tahsilat ERP'ye yazıldı: ${webTahsilat.id}`);
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

    await request.query(`
      INSERT INTO CARI_HESAP_HAREKETLERI (
        cha_tarihi, cha_belge_tarih, cha_kod, cha_meblag, cha_aratoplam,
        cha_aciklama, cha_tpoz, cha_cari_cins, cha_evrak_tip,
        cha_tip, cha_cinsi, cha_normal_iade,
        cha_evrakno_sira, cha_evrakno_seri, cha_vade
      )
      VALUES (
        @cha_tarihi, @cha_belge_tarih, @cha_kod, @cha_meblag, @cha_aratoplam,
        @cha_aciklama, @cha_tpoz, @cha_cari_cins, @cha_evrak_tip,
        @cha_tip, @cha_cinsi, @cha_normal_iade,
        @cha_evrakno_sira, @cha_evrakno_seri, @cha_vade
      )
    `);
  }

  async insertOdemeEmri(data, transaction) {
    const request = transaction.request();
    
    Object.keys(data).forEach(key => {
      request.input(key, data[key]);
    });

    await request.query(`
      INSERT INTO ODEME_EMIRLERI (
        sck_no, sck_banka_adres1, sck_sube_adres2, sck_hesapno_sehir,
        sck_tutar, sck_vade, sck_duzen_tarih, sck_sahip_cari_kodu,
        sck_tip, sck_doviz, sck_odenen, sck_iptal
      )
      VALUES (
        @sck_no, @sck_banka_adres1, @sck_sube_adres2, @sck_hesapno_sehir,
        @sck_tutar, @sck_vade, @sck_duzen_tarih, @sck_sahip_cari_kodu,
        @sck_tip, @sck_doviz, @sck_odenen, @sck_iptal
      )
    `);
  }
}

module.exports = new TahsilatProcessor();
