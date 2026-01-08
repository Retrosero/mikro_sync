const logger = require('../utils/logger');

class StokHareketTransformer {
    async transformToERP(webData, stokKod, index = 0) {
        try {
            // Hareket tipi: giris -> 0, cikis -> 1
            const sth_tip = webData.hareket_tipi === 'giris' ? 0 : 1;

            // Tarih formatla (YYYYMMDD) - Yerel saate göre (UTC kaymasını engellemek için)
            const date = new Date(webData.islem_tarihi);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const tarihStr = `${year}${month}${day}`;

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
                sth_isk_mas1: 0, sth_isk_mas2: 1, sth_isk_mas3: 1, sth_isk_mas4: 1, sth_isk_mas5: 1,
                sth_isk_mas6: 1, sth_isk_mas7: 1, sth_isk_mas8: 1, sth_isk_mas9: 1, sth_isk_mas10: 1,
                sth_iskonto1: 0, sth_iskonto2: 0, sth_iskonto3: 0, sth_iskonto4: 0, sth_iskonto5: 0, sth_iskonto6: 0,
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
                sth_vergi_pntr: 1, // KDV ? (Sayımda genellikle 0 veya stoğun vergisi) - user requested 1
                sth_vergi: 0,
                sth_muh_fisi_no: 0,

                // Eksik alanlar
                sth_special1: '', sth_special2: '', sth_special3: '',
                sth_masraf1: 0, sth_masraf2: 0, sth_masraf3: 0, sth_masraf4: 0,
                sth_masraf_vergi_pntr: 0, sth_masraf_vergi: 0,
                sth_plasiyer_kodu: '',
                sth_proje_kodu: '', sth_exim_kodu: '',
                sth_otv_pntr: 0, sth_otv_vergi: 0, sth_otvtutari: 0, sth_otvvergisiz_fl: 0,
                sth_oiv_pntr: 0, sth_oiv_vergi: 0, sth_oivtutari: 0, sth_oivvergisiz_fl: 0,
                sth_fiyat_liste_no: 0,
                sth_netagirlik: 0, sth_brutagirlik: 0,
                sth_disticaret_turu: 0, sth_Tevkifat_turu: 0,
                sth_nakliyedeposu: 0, sth_nakliyedurumu: 0,
                sth_yetkili_recid_dbcno: 0, sth_yetkili_recid_recno: 0,
                sth_taxfree_fl: 0, sth_ilave_edilecek_kdv: 0,
                sth_odeme_op: 0,
                sth_sip_recid_dbcno: 0, sth_sip_recid_recno: 0,
                sth_fat_recid_dbcno: 0, sth_fat_recid_recno: 0, // Önceki kodda bu vardı ama eksikti
                sth_kons_recid_dbcno: 0, sth_kons_recid_recno: 0,
                sth_cari_srm_merkezi: 0, sth_stok_srm_merkezi: 0,
                sth_fis_sirano: 0, sth_vergisiz_fl: 0,
                sth_maliyet_ana: 0, sth_maliyet_alternatif: 0, sth_maliyet_orjinal: 0,
                sth_adres_no: 1, sth_parti_kodu: '', sth_lot_no: 0
            };

            // Sayım fişi specific (10)
            if (webData.belge_tipi === 'sayim') {
                return {
                    ...defaultValues,
                    sth_stok_kod: stokKod,
                    sth_tarih: tarihStr,
                    sth_tip: 1,
                    sth_cins: 10, // Sayım Fişi
                    sth_evrakno_seri: webData.fatura_seri_no || '',
                    sth_evrakno_sira: webData.fatura_sira_no || 0,
                    sth_satirno: index, // Return to index to allow multiple items
                    sth_belge_no: '',
                    sth_belge_tarih: tarihStr,
                    sth_miktar: webData.miktar,
                    sth_tutar: webData.toplam_tutar || 0,
                    sth_aciklama: 'SAYIM' + (webData.aciklama ? ' - ' + webData.aciklama : ''),
                    sth_giris_depo_no: 1,
                    sth_cikis_depo_no: 1, // sth_cikis_depo_no = 1 as requested
                    sth_maliyet_ana: 0,
                    sth_isemri_gider_kodu: webData.sth_isemri_gider_kodu || '',
                    sth_cari_srm_merkezi: '', // Empty as requested
                    sth_stok_srm_merkezi: '', // Empty as requested
                    sth_fis_tarihi: '1899-12-30 00:00:00.000',
                    sth_adres_no: 1 // Explicitly set again to be sure
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
