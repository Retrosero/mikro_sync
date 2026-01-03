/**
 * Barkod Processor - Web -> ERP Barkod Senkronizasyonu
 * 
 * Bu dosya, Web'deki urun_barkodlari tablosundan ERP'deki BARKOD_TANIMLARI 
 * tablosuna barkod verilerini aktarmak için kullanılır.
 */

const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

// Barkod tipi mapping (Web -> ERP)
const BARKOD_TIPI_MAP = {
    'ana': 0,
    'standart': 0,
    'koli': 2,
    'palet': 3
};

// Tersi mapping (ERP -> Web)
const BARKOD_TIPI_REVERSE_MAP = {
    0: 'ana',
    1: 'ana', // Eski kayıtlar için uyumluluk
    2: 'koli',
    3: 'palet'
};

class BarkodProcessor {
    constructor() {
        this.tableName = 'BARKOD_TANIMLARI';
    }

    /**
     * Web'den gelen barkod kaydını ERP'ye senkronize eder
     * @param {Object} webBarkod - Web barkod kaydı (urun_barkodlari tablosundan)
     */
    async syncToERP(webBarkod) {
        try {
            logger.info(`Barkod ERP'ye senkronize ediliyor: ${webBarkod.barkod}`);

            // 1. Stok kodunu bul (stok_id -> stok_kodu -> int_kodmap_stok -> erp_stok_kod)
            const stokMapping = await this.getStokKodFromWebId(webBarkod.stok_id);

            if (!stokMapping) {
                throw new Error(`Stok mapping bulunamadı: stok_id=${webBarkod.stok_id}`);
            }

            const stokKod = stokMapping.erp_stok_kod;
            logger.info(`Stok kodu bulundu: ${stokKod}`);

            // 2. ERP'de bu barkod var mı kontrol et
            const existingBarkod = await mssqlService.query(
                `SELECT bar_RECno FROM BARKOD_TANIMLARI WHERE bar_kodu = @barkod`,
                { barkod: webBarkod.barkod }
            );

            const updateDate = new Date().toISOString().replace('T', ' ').substring(0, 23);
            const barkodTipi = BARKOD_TIPI_MAP[webBarkod.barkod_tipi] !== undefined ? BARKOD_TIPI_MAP[webBarkod.barkod_tipi] : 0;
            const iptal = webBarkod.aktif === false ? 1 : 0;

            if (existingBarkod.length > 0) {
                // UPDATE - Mevcut barkodu güncelle
                const barRecno = existingBarkod[0].bar_RECno;

                await mssqlService.query(
                    `UPDATE BARKOD_TANIMLARI SET 
            bar_lastup_date = @lastupDate,
            bar_lastup_user = 1,
            bar_stokkodu = @stokKod,
            bar_barkodtipi = @barkodTipi,
            bar_iptal = @iptal
          WHERE bar_RECno = @barRecno`,
                    {
                        lastupDate: updateDate,
                        stokKod: stokKod,
                        barkodTipi: barkodTipi,
                        iptal: iptal,
                        barRecno: barRecno
                    }
                );

                logger.info(`✓ Barkod ERP'de güncellendi: ${webBarkod.barkod} (RECno: ${barRecno})`);
            } else {
                // INSERT - Yeni barkod ekle
                const insertResult = await mssqlService.query(`
          INSERT INTO BARKOD_TANIMLARI (
            bar_RECid_DBCno, bar_RECid_RECno, bar_SpecRECno, bar_iptal,
            bar_fileid, bar_hidden, bar_kilitli, bar_degisti, bar_checksum,
            bar_create_user, bar_create_date, bar_lastup_user, bar_lastup_date,
            bar_special1, bar_special2, bar_special3,
            bar_stokkodu, bar_kodu, bar_barkodtipi, bar_birimpntr,
            bar_partikodu, bar_lotno, bar_serino_veya_bagkodu, bar_icerigi,
            bar_master, bar_bedenpntr, bar_renkpntr, bar_baglantitipi,
            bar_harrecid_dbcno, bar_harrecid_recno
          ) VALUES (
            0, 0, 0, @iptal,
            13, 0, 0, 0, 0,
            1, @createDate, 1, @lastupDate,
            N'', N'', N'',
            @stokKod, @barkod, @barkodTipi, 1,
            N'', N'', N'', N'',
            0, 0, 0, 0,
            0, 0
          );
          SELECT SCOPE_IDENTITY() AS bar_RECno;
        `, {
                    iptal: iptal,
                    createDate: updateDate,
                    lastupDate: updateDate,
                    stokKod: stokKod,
                    barkod: webBarkod.barkod,
                    barkodTipi: barkodTipi
                });

                // RECid_RECno güncelle
                if (insertResult && insertResult[0]) {
                    const barRecno = insertResult[0].bar_RECno;
                    await mssqlService.query(
                        `UPDATE BARKOD_TANIMLARI SET bar_RECid_RECno = @recno WHERE bar_RECno = @recno`,
                        { recno: barRecno }
                    );
                    logger.info(`✓ Yeni barkod ERP'ye eklendi: ${webBarkod.barkod} (RECno: ${barRecno})`);
                }
            }

            return true;

        } catch (error) {
            logger.error(`Barkod ERP senkronizasyon hatası (${webBarkod.barkod}):`, error);
            throw error;
        }
    }

    /**
     * Web stok_id'sinden ERP stok kodunu bulur
     * @param {string} webStokId - Web stok ID (UUID)
     * @returns {Object|null} - { web_stok_id, erp_stok_kod } veya null
     */
    async getStokKodFromWebId(webStokId) {
        try {
            // Önce int_kodmap_stok tablosundan bak
            const mapping = await pgService.queryOne(
                `SELECT web_stok_id, erp_stok_kod 
         FROM int_kodmap_stok 
         WHERE web_stok_id = $1`,
                [webStokId]
            );

            if (mapping) {
                return mapping;
            }

            // Mapping yoksa stoklar tablosundan stok_kodu'nu al ve mapping oluşturmayı dene
            const stok = await pgService.queryOne(
                `SELECT id, stok_kodu FROM stoklar WHERE id = $1`,
                [webStokId]
            );

            if (stok) {
                // Bu stok kodu ERP'de var mı kontrol et
                const erpStok = await mssqlService.query(
                    `SELECT sto_kod FROM STOKLAR WHERE sto_kod = @stokKod`,
                    { stokKod: stok.stok_kodu }
                );

                if (erpStok.length > 0) {
                    // Mapping oluştur
                    await pgService.query(
                        `INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod) 
             VALUES ($1, $2)
             ON CONFLICT (web_stok_id) DO UPDATE SET erp_stok_kod = EXCLUDED.erp_stok_kod`,
                        [webStokId, stok.stok_kodu]
                    );

                    return { web_stok_id: webStokId, erp_stok_kod: stok.stok_kodu };
                }
            }

            return null;
        } catch (error) {
            logger.error('Stok mapping bulma hatası:', error);
            return null;
        }
    }

    /**
     * ERP'den Web'e barkod senkronizasyonu (mevcut stok.processor içinde var)
     * Bu metod gelecekte genişletilmek için ayrıldı
     */
    async syncToWeb(erpBarkod) {
        // Bu işlem şu an stok.processor.js içinde syncBarkodlar metodunda yapılıyor
        // Gerekirse buraya taşınabilir
        logger.info('Barkod ERP→Web senkronizasyonu için stok.processor.syncBarkodlar kullanılıyor');
    }

    /**
     * Barkod silme işlemi (Web'den silinen barkodu ERP'de iptal et)
     * @param {string} barkod - Silinecek barkod değeri
     */
    async deleteFromERP(barkod) {
        try {
            logger.info(`Barkod ERP'de iptal ediliyor: ${barkod}`);

            const updateDate = new Date().toISOString().replace('T', ' ').substring(0, 23);

            // ERP'de barkodu iptal et (fiziksel silme yerine)
            const result = await mssqlService.query(
                `UPDATE BARKOD_TANIMLARI SET 
          bar_iptal = 1,
          bar_lastup_date = @lastupDate,
          bar_lastup_user = 1
        WHERE bar_kodu = @barkod`,
                {
                    lastupDate: updateDate,
                    barkod: barkod
                }
            );

            logger.info(`✓ Barkod ERP'de iptal edildi: ${barkod}`);
            return true;

        } catch (error) {
            logger.error(`Barkod iptal hatası (${barkod}):`, error);
            throw error;
        }
    }
}

module.exports = new BarkodProcessor();
