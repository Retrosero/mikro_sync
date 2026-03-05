const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

class ReyonProcessor {
    constructor() {
        this.tableName = 'STOK_REYONLARI';
    }

    /**
     * Web'den ERP'ye reyon senkronizasyonu
     * @param {Object} reyonData - Web reyon kaydı
     */
    async syncToERP(reyonData) {
        try {
            logger.info(`Reyon ERP'ye senkronize ediliyor: ${reyonData.reyon_kodu}`);

            const rynKod = reyonData.reyon_kodu;
            const rynIsmi = reyonData.reyon_adi || rynKod;
            const updateDate = new Date().toISOString().replace('T', ' ').substring(0, 23);

            // 1. Reyon koduna göre ERP'deki kaydı bul
            const erpReyonResult = await mssqlService.query(
                `SELECT ryn_RECno FROM STOK_REYONLARI WHERE ryn_kod = @rynKod`,
                { rynKod }
            );

            if (erpReyonResult.length === 0) {
                // YENİ REYON - INSERT işlemi
                logger.info(`Yeni reyon ERP'ye ekleniyor: ${rynKod}`);

                const insertResult = await mssqlService.query(`
          INSERT INTO STOK_REYONLARI (
            ryn_RECid_DBCno, ryn_RECid_RECno, ryn_SpecRECno, ryn_iptal, ryn_fileid, 
            ryn_hidden, ryn_kilitli, ryn_degisti, ryn_checksum, ryn_create_user, 
            ryn_create_date, ryn_lastup_user, ryn_lastup_date, ryn_special1, 
            ryn_special2, ryn_special3, ryn_kod, ryn_ismi
          ) VALUES (
            0, 0, 0, 0, 27, 
            0, 0, 0, 0, 1, 
            @createDate, 1, @lastupDate, N'', 
            N'', N'', @rynKod, @rynIsmi
          );
          SELECT SCOPE_IDENTITY() AS ryn_RECno;
        `, {
                    createDate: updateDate,
                    lastupDate: updateDate,
                    rynKod: this.truncate(rynKod, 25),
                    rynIsmi: this.truncate(rynIsmi, 50)
                });

                const rynRecno = insertResult[0].ryn_RECno;

                // RECid_RECno güncelle (Mikro standartlarına göre)
                await mssqlService.query(
                    `UPDATE STOK_REYONLARI SET ryn_RECid_RECno = @recno WHERE ryn_RECno = @recno`,
                    { recno: rynRecno }
                );

                logger.info(`✓ Yeni reyon ERP'ye eklendi: ${rynKod} (RECno: ${rynRecno})`);
            } else {
                // MEVCUT REYON - UPDATE işlemi
                const rynRecno = erpReyonResult[0].ryn_RECno;

                await mssqlService.query(`
          UPDATE STOK_REYONLARI SET 
            ryn_lastup_date = @lastupDate,
            ryn_ismi = @rynIsmi
          WHERE ryn_RECno = @rynRecno
        `, {
                    lastupDate: updateDate,
                    rynIsmi: this.truncate(rynIsmi, 50),
                    rynRecno: rynRecno
                });

                logger.info(`✓ Reyon bilgileri ERP'ye güncellendi: ${rynKod} (RECno: ${rynRecno})`);
            }

            return true;
        } catch (error) {
            logger.error(`Reyon ERP senkronizasyon hatası (${reyonData.reyon_kodu}):`, error);
            throw error;
        }
    }

    /**
     * MS SQL kolon boyutlarına göre string kırpma
     */
    truncate(str, maxLen) {
        if (!str) return '';
        return String(str).substring(0, maxLen);
    }

    /**
     * Generic process metodu
     */
    async process(recordData, operation) {
        if (operation === 'INSERT' || operation === 'UPDATE') {
            await this.syncToERP(recordData);
        }
    }
}

module.exports = new ReyonProcessor();
