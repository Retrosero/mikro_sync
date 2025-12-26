const logger = require('../utils/logger');

class SayimTransformer {
    transformToERP(webData, stokKod, satirNo = 0) {
        try {
            // Tarih formatla (YYYYMMDD)
            const date = new Date(webData.islem_tarihi);
            const tarihStr = date.toISOString().slice(0, 10).replace(/-/g, '');
            // Create user date format (YYYYMMDD HH:mm:ss.MS) - Trace formatı '20251226 14:37:43.345' benzeri
            // Ancak MS SQL driver Date objesini kabul eder, manuel stringe gerek kalmayabilir.
            // Trace'deki: '20251226' -> sym_tarihi

            return {
                sym_RECid_DBCno: 0,
                sym_RECid_RECno: 0, // Insert sonrası update edilecek
                sym_SpecRECno: 0,
                sym_iptal: 0,
                sym_fileid: 28, // SAYIM_SONUCLARI dosya ID
                sym_hidden: 0,
                sym_kilitli: 0,
                sym_degisti: 0,
                sym_checksum: 0,
                sym_create_user: 1, // Admin (Trace: 4)
                sym_create_date: new Date(),
                sym_lastup_user: 1,
                sym_lastup_date: new Date(),
                sym_special1: '',
                sym_special2: '',
                sym_special3: '',
                sym_tarihi: tarihStr,
                sym_depono: 1, // Trace: 1. Web'den geleni kullanabiliriz veya varsayılan 1
                sym_evrakno: webData.fatura_sira_no || 1, // Trace: 1. Evrak no integer gibi görünüyor.
                sym_satirno: satirNo, // Processor'dan gelecek (dinamik)
                sym_Stokkodu: stokKod,
                sym_reyonkodu: '0',
                sym_koridorkodu: '0',
                sym_rafkodu: '0',
                sym_miktar1: webData.miktar,
                sym_miktar2: 0,
                sym_miktar3: 0,
                sym_miktar4: 0,
                sym_miktar5: 0,
                sym_birim_pntr: 1, // Varsayılan 1.Birim
                sym_barkod: '',
                sym_renkno: 0,
                sym_bedenno: 0,
                sym_parti_kodu: '',
                sym_lot_no: 0,
                sym_serino: ''
            };

        } catch (error) {
            logger.error('Sayım transform hatası:', error);
            throw error;
        }
    }
}

module.exports = new SayimTransformer();
