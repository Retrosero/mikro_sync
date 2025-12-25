const logger = require('../utils/logger');

class StokHareketTransformer {
    async transformToERP(webData, stokKod) {
        try {
            // Hareket tipi: giris -> 0, cikis -> 1
            const sth_tip = webData.hareket_tipi === 'giris' ? 0 : 1;
            
            // Tarih formatla (YYYYMMDD)
            const date = new Date(webData.islem_tarihi);
            const tarihStr = date.toISOString().slice(0, 10).replace(/-/g, '');
            
            // Varsayılan değerler
            const defaultValues = {
                sth_RECid_DBCno: 0,
                sth_RECid_RECno: 0,
                sth_SpecRECno: 0,
                sth_iptal: 0,
                sth_fileid: 16, // STOK_HAREKETLERI dosya ID
                sth_hidden: 0,
                sth_kilitli: 0,
                sth_degisti: 0,
                sth_checksum: 0,
                sth_create_user: 1, // Admin
                sth_lastup_user: 1,
                sth_firmano: 0,
                sth_subeno: 0,
                sth_normal_iade: 0,
                sth_evraktip: 0,
                sth_isk_mas1: 0, sth_isk_mas2: 0, sth_isk_mas3: 0, sth_isk_mas4: 0, sth_isk_mas5: 0,
                sth_isk_mas6: 0, sth_isk_mas7: 0, sth_isk_mas8: 0, sth_isk_mas9: 0, sth_isk_mas10: 0,
                sth_sat_iskmas1: 0, sth_sat_iskmas2: 0, sth_sat_iskmas3: 0, sth_sat_iskmas4: 0, sth_sat_iskmas5: 0,
                sth_sat_iskmas6: 0, sth_sat_iskmas7: 0, sth_sat_iskmas8: 0, sth_sat_iskmas9: 0, sth_sat_iskmas10: 0,
                sth_pos_satis: 0,
                sth_promosyon_fl: 0,
                sth_cari_cinsi: 0, // 0: Yok
                sth_cari_kodu: '',
                sth_cari_grup_no: 0,
                sth_har_doviz_cinsi: 0,
                sth_har_doviz_kuru: 1,
                sth_alt_doviz_kuru: 1,
                sth_stok_doviz_cinsi: 0,
                sth_stok_doviz_kuru: 1,
                sth_miktar2: 0,
                sth_birim_pntr: 1, // 1. Birim ? (Varsayılan olarak kabul ediyoruz)
                sth_vergi_pntr: 0, // KDV ? (Sayımda genellikle 0 veya stoğun vergisi)
                sth_vergi: 0,
                sth_muh_fisi_no: 0
            };

            // Sayım fişi specific (10)
            if (webData.belge_tipi === 'sayim') {
                return {
                    ...defaultValues,
                    sth_stok_kod: stokKod,
                    sth_tarih: tarihStr,
                    sth_tip: sth_tip,
                    sth_cins: 10, // Sayım Fişi
                    sth_evrakno_seri: webData.fatura_seri_no || '',
                    sth_evrakno_sira: webData.fatura_sira_no || 0,
                    sth_satirno: 0, // Bu insert sırasında belirlenebilir veya 0
                    sth_belge_no: webData.belge_no || '',
                    sth_belge_tarih: tarihStr,
                    sth_miktar: webData.miktar,
                    sth_tutar: webData.toplam_tutar || 0,
                    sth_aciklama: 'SAYIM' + (webData.aciklama ? ' - ' + webData.aciklama : ''),
                    sth_giris_depo_no: sth_tip === 0 ? 1 : 0, // Giriş ise 1. Çıkış ise depo ? Trace'de giris icin giris_depo_no=1.
                    sth_cikis_depo_no: sth_tip === 1 ? 1 : 0,
                    sth_maliyet_ana: 0, // Maliyetler sonra hesaplanır genelde
                    sth_isemri_gider_kodu: webData.sth_isemri_gider_kodu || ''
                };
            }

            throw new Error(`Deteklenmeyen belge tipi: ${webData.belge_tipi}`);

        } catch (error) {
            logger.error('Stok Hareket transform hatası:', error);
            throw error;
        }
    }
}

module.exports = new StokHareketTransformer();
