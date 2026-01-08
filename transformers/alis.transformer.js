const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Tarih formatını MSSQL için dönüştür (YYYY-MM-DD 00:00:00.000)
function formatDateTimeForMSSQL(date) {
    if (!date) return '1899-12-30 00:00:00.000';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const milliseconds = String(d.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// Sadece tarih (YYYY-MM-DD 00:00:00.000) - MSSQL için en güvenli format
function formatDateOnlyForMSSQL(date) {
    if (!date) return '1899-12-30 00:00:00.000';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} 00:00:00.000`;
}

class AlisTransformer {
    // Web → ERP: Alış Başlık (Normal ve İade)
    async transformAlisBaslik(webAlis) {
        try {
            // 1. Cari Kodu Bul
            // DB'de tedarikci_id olarak tutuluyor olabilir
            const cariId = webAlis.tedarikci_id || webAlis.cari_hesap_id;
            const cariKod = await lookupTables.getCariKod(cariId);

            if (!cariKod) {
                const keys = Object.keys(webAlis).join(',');
                throw new Error(`Cari mapping bulunamadı: ${cariId} (Keys: ${keys})`);
            }

            // 2. Ödeme Tipi ve Cari Cins Belirle
            // Varsayılan: Açık Hesap
            let chaTpoz = 0;
            let chaCariCins = 0; // 0: Cari, 2: Banka, 4: Kasa
            let chaGrupno = 0;   // 0: Normal, 1: Banka? Değişebilir.

            const oSekli = webAlis.odeme_sekli || 'acik_hesap';

            if (oSekli === 'nakit' || webAlis.kasa_id || webAlis.kasa_kodu) {
                // Kasa - Alış
                // Trace: cha_tpoz=1, cha_cari_cins=4, cha_kod=KasaKodu, cha_ciro=CariKodu
                chaTpoz = 1;
                chaCariCins = 4;
                chaGrupno = 0;
            } else if (oSekli === 'havale' || webAlis.banka_id || webAlis.banka_kodu) {
                // Banka - Alış
                // Mapping mantığı Kasa ile benzer: cha_tpoz=1, cha_cari_cins=2
                chaTpoz = 1;
                chaCariCins = 2;
                chaGrupno = 1; // Banka işlemlerinde genelde 1 olur
            } else {
                // Açık Hesap
                chaTpoz = 0;
                chaCariCins = 0;
                chaGrupno = 0;
            }

            // 3. cha_kod ve cha_ciro_cari_kodu Belirle
            let chaKod = cariKod;
            let chaCiroCariKodu = cariKod; // Alış işlemlerinde (Kasa/Banka dahil) ciro kodu Cari Kod oluyor

            if (chaCariCins === 4) { // Kasa
                // Kasa kodunu bul
                let kasaKod = null;
                if (webAlis.kasa_id) {
                    kasaKod = await lookupTables.getKasaKod(webAlis.kasa_id);
                }
                if (!kasaKod && webAlis.kasa_kodu) {
                    kasaKod = webAlis.kasa_kodu;
                }
                if (!kasaKod) {
                    kasaKod = '001'; // Varsayılan Kasa
                }
                chaKod = kasaKod;
            } else if (chaCariCins === 2) { // Banka
                // Banka kodunu bul
                let bankaKod = null;
                if (webAlis.banka_id) {
                    bankaKod = await lookupTables.getBankaKod(webAlis.banka_id);
                }
                if (!bankaKod && webAlis.banka_kodu) {
                    bankaKod = webAlis.banka_kodu;
                }
                if (bankaKod) {
                    chaKod = bankaKod;
                }
            }

            // Normal Açık Hesap durumunda cha_kod = CariKod, cha_ciro_cari_kodu = CariKod
            // Trace: cha_kod='SERHAN', cha_ciro_cari_kodu='SERHAN'

            // İade Kontrolü
            const isIade = webAlis.fatura_tipi === 'iade' || webAlis.iade === true;
            const chaNormalIade = isIade ? 1 : 0;

            // Açıklama
            let chaAciklama = webAlis.aciklama || '';
            if (!chaAciklama) {
                // Cari adını bulup ekleyebiliriz (opsiyonel)
                const pgService = require('../services/postgresql.service');
                const cariInfo = await pgService.query('SELECT cari_adi FROM cari_hesaplar WHERE id = $1', [cariId]);
                if (cariInfo.length > 0) {
                    chaAciklama = cariInfo[0].cari_adi;
                }
            }

            const islemTarihi = webAlis.fatura_tarihi || webAlis.alis_tarihi || new Date();

            return {
                cha_tarihi: formatDateOnlyForMSSQL(islemTarihi),
                cha_belge_tarih: formatDateOnlyForMSSQL(islemTarihi),
                cha_evrakno_sira: null, // Processor belirleyecek
                cha_evrakno_seri: webAlis.fatura_seri_no || '',
                cha_belge_no: webAlis.belge_no || '',
                cha_satir_no: 0,
                cha_kod: chaKod,
                cha_ciro_cari_kodu: chaCiroCariKodu,
                cha_meblag: webAlis.toplam_tutar,
                cha_aratoplam: webAlis.ara_toplam || webAlis.toplam_tutar,
                cha_aciklama: chaAciklama.substring(0, 50),
                cha_tpoz: chaTpoz,
                cha_cari_cins: chaCariCins,
                // İskontolar
                cha_ft_iskonto1: webAlis.iskonto1 || webAlis.indirim_tutari || 0,
                cha_ft_iskonto2: webAlis.iskonto2 || webAlis.indirim_tutari2 || 0,
                cha_ft_iskonto3: webAlis.iskonto3 || webAlis.indirim_tutari3 || 0,
                cha_ft_iskonto4: webAlis.iskonto4 || webAlis.indirim_tutari4 || 0,
                cha_ft_iskonto5: webAlis.iskonto5 || webAlis.indirim_tutari5 || 0,
                cha_ft_iskonto6: webAlis.iskonto6 || webAlis.indirim_tutari6 || 0,
                // Sabit Değerler (Trace Analizinden)
                cha_evrak_tip: 0,  // Alış Faturası
                cha_tip: 1,        // Alacak (Borç/Alacak mantığı: Biz borçlanıyoruz)
                cha_cinsi: 6,      // Fatura
                cha_normal_Iade: chaNormalIade,

                cha_d_cins: 0,
                cha_d_kur: 1,
                cha_altd_kur: 1,
                cha_karsid_kur: 1,
                cha_create_user: 1,
                cha_lastup_user: 1,
                cha_create_date: formatDateTimeForMSSQL(new Date()),
                cha_lastup_date: formatDateTimeForMSSQL(new Date()),
                cha_firmano: 0,
                cha_subeno: 0,
                cha_kasa_hizmet: 0, // Alış işleminde kasa olsa bile 0 görünüyor
                cha_kasa_hizkod: '',
                cha_grupno: chaGrupno,
                cha_srmrkkodu: '',
                cha_karsidcinsi: 0,
                cha_special1: '',
                cha_special2: '',
                cha_special3: '',
                cha_satici_kodu: '',
                cha_EXIMkodu: '',
                cha_ticaret_turu: 0,
                cha_projekodu: '',
                cha_yat_tes_kodu: '',
                cha_karsidgrupno: 0,
                cha_karsisrmrkkodu: '',
                cha_miktari: 0,
                cha_vade: 0,
                cha_Vade_Farki_Yuz: 0,
                cha_yuvarlama: 0,
                cha_StFonPntr: 0,
                cha_stopaj: 0,
                cha_savsandesfonu: 0,
                cha_avansmak_damgapul: 0,
                cha_vergipntr: 0,
                cha_vergisiz_fl: 0,
                cha_otvtutari: 0,
                cha_oiv_pntr: 0,
                cha_oivtutari: 0,
                cha_fis_tarih: '1899-12-30 00:00:00.000',
                cha_fis_sirano: 0,
                cha_trefno: '',
                cha_sntck_poz: 0,
                cha_reftarihi: '1899-12-30 00:00:00.000',
                cha_istisnakodu: 0,
                cha_pos_hareketi: 0,
                cha_meblag_ana_doviz_icin_gecersiz_fl: 0,
                cha_meblag_alt_doviz_icin_gecersiz_fl: 0,
                cha_meblag_orj_doviz_icin_gecersiz_fl: 0,
                cha_sip_recid_dbcno: 0,
                cha_sip_recid_recno: 0,
                cha_kirahar_recid_dbcno: 0,
                cha_kirahar_recid_recno: 0,
                cha_vardiya_tarihi: '1899-12-30 00:00:00.000',
                cha_vardiya_no: 0,
                cha_vardiya_evrak_ti: 0,
                cha_ebelge_cinsi: 0,
                cha_tevkifat_toplam: 0,
                cha_e_islem_turu: 0,
                cha_fatura_belge_turu: 0,
                cha_diger_belge_adi: '',
                cha_uuid: crypto.randomUUID().toUpperCase()
            };
        } catch (error) {
            logger.error('Alış başlık transform hatası:', error);
            throw error;
        }
    }

    // Web → ERP: Alış Kalem
    async transformAlisKalem(webKalem, webAlis) {
        try {
            const stokKod = await lookupTables.getStokKod(webKalem.stok_id);
            const cariId = webAlis.tedarikci_id || webAlis.cari_hesap_id;
            const cariKod = await lookupTables.getCariKod(cariId);

            if (!stokKod) {
                throw new Error(`Stok mapping bulunamadı: ${webKalem.stok_id}`);
            }

            const isIade = webAlis.fatura_tipi === 'iade' || webAlis.iade === true;
            const sthNormalIade = isIade ? 1 : 0;
            const islemTarihi = webAlis.fatura_tarihi || webAlis.alis_tarihi || new Date();

            return {
                sth_stok_kod: stokKod,
                sth_miktar: webKalem.miktar,
                sth_tutar: webKalem.toplam_tutar,
                sth_vergi: webKalem.kdv_tutari || 0,
                sth_vergi_pntr: 1,
                sth_tarih: formatDateOnlyForMSSQL(islemTarihi),
                sth_belge_tarih: formatDateOnlyForMSSQL(islemTarihi),
                sth_cari_kodu: cariKod,
                sth_cikis_depo_no: 1,
                sth_giris_depo_no: 1,
                // İskontolar
                sth_iskonto1: webKalem.iskonto1 || webKalem.indirim_tutari || 0,
                sth_iskonto2: webKalem.iskonto2 || webKalem.indirim_tutari2 || 0,
                sth_iskonto3: webKalem.iskonto3 || webKalem.indirim_tutari3 || 0,
                sth_iskonto4: webKalem.iskonto4 || webKalem.indirim_tutari4 || 0,
                sth_iskonto5: webKalem.iskonto5 || webKalem.indirim_tutari5 || 0,
                sth_iskonto6: webKalem.iskonto6 || webKalem.indirim_tutari6 || 0,
                // Sabit Değerler
                sth_tip: 0,
                sth_cins: 0,
                sth_normal_iade: sthNormalIade,
                sth_evraktip: 3,
                sth_evrakno_seri: webAlis.fatura_seri_no || 'AL',
                sth_evrakno_sira: webAlis.fatura_sira_no || 0,
                sth_satirno: 0, // Processor'da set edilecek
                sth_belge_no: '',
                sth_create_user: 1,
                sth_lastup_user: 1,
                sth_create_date: formatDateTimeForMSSQL(new Date()),
                sth_lastup_date: formatDateTimeForMSSQL(new Date()),
                sth_firmano: 0,
                sth_subeno: 0,
                sth_malkbl_sevk_tarihi: formatDateOnlyForMSSQL(islemTarihi),
                sth_fis_tarihi: '1899-12-30 00:00:00.000',
                sth_fis_sirano: 0,
                sth_special1: '',
                sth_special2: '',
                sth_special3: '',
                sth_vergisiz_fl: 0,
                sth_maliyet_ana: 0,
                sth_maliyet_alternatif: 0,
                sth_maliyet_orjinal: 0,
                sth_adres_no: 0,
                sth_parti_kodu: '',
                sth_lot_no: 0,
                sth_proje_kodu: '',
                sth_exim_kodu: '',
                sth_otv_pntr: 0,
                sth_otv_vergi: 0,
                sth_brutagirlik: 0,
                sth_disticaret_turu: 0,
                sth_otvtutari: 0,
                sth_otvvergisiz_fl: 0,
                sth_oiv_pntr: 0,
                sth_oiv_vergi: 0,
                sth_oivvergisiz_fl: 0,
                sth_fiyat_liste_no: 1,
                sth_oivtutari: 0,
                sth_Tevkifat_turu: 0,
                sth_nakliyedeposu: 0,
                sth_nakliyedurumu: 0,
                sth_taxfree_fl: 0,
                sth_ilave_edilecek_kdv: 0,
                sth_pos_satis: 0,
                sth_promosyon_fl: 0,
                sth_cari_cinsi: 0,
                sth_cari_grup_no: 0,
                sth_isemri_gider_kodu: '',
                sth_plasiyer_kodu: '',
                sth_miktar2: 0,
                sth_birim_pntr: 1,
                sth_netagirlik: 0,
                sth_odeme_op: 0,
                sth_aciklama: '',
                sth_sip_recid_dbcno: 0,
                sth_sip_recid_recno: 0,
                sth_cari_srm_merkezi: '',
                sth_stok_srm_merkezi: '',
                sth_kons_recid_dbcno: 0,
                sth_kons_recid_recno: 0,
                sth_yetkili_recid_dbcno: 0,
                sth_yetkili_recid_recno: 0
            };
        } catch (error) {
            logger.error('Alış kalem transform hatası:', error);
            throw error;
        }
    }
}

module.exports = new AlisTransformer();
