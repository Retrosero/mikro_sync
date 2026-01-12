const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class CariProcessor {
    constructor() {
        this.tableName = 'CARI_HESAPLAR';
        this.BATCH_SIZE = 2000;
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Cari senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen cari bulundu`);

            let processedCount = 0;
            let errorCount = 0;

            // Batch işleme
            for (let i = 0; i < changedRecords.length; i += this.BATCH_SIZE) {
                const batch = changedRecords.slice(i, i + this.BATCH_SIZE);
                try {
                    await this.processBatch(batch);
                    processedCount += batch.length;
                    logger.info(`  ${processedCount}/${changedRecords.length} cari işlendi...`);
                } catch (error) {
                    errorCount += batch.length;
                    logger.error(`Batch hatası (${i}-${i + batch.length}):`, error.message);
                }
            }

            await syncStateService.updateSyncTime(
                this.tableName,
                direction,
                processedCount,
                errorCount === 0,
                errorCount > 0 ? `${errorCount} hata oluştu` : null
            );

            logger.info(`Cari senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Cari senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1'; // Aktiflik kontrolü gerekirse eklenir (örn. cari_locked=0)
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND cari_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        // Adres bilgisi için LEFT JOIN eklenebilir ama şimdilik basit tutalım
        const query = `
      SELECT 
        cari_kod, cari_unvan1, cari_unvan2, 
        cari_CepTel, cari_EMail, 
        cari_vdaire_adi, cari_vdaire_no,
        cari_lastup_date,
        cari_baglanti_tipi
      FROM CARI_HESAPLAR
      ${whereClause}
      ORDER BY cari_lastup_date
    `;

        return await mssqlService.query(query, params);
    }

    async processBatch(batch) {
        if (batch.length === 0) return;

        const rows = batch.map(erpCari => ({
            cari_kodu: erpCari.cari_kod,
            cari_adi: (erpCari.cari_unvan1 + ' ' + (erpCari.cari_unvan2 || '')).trim(),
            telefon: erpCari.cari_CepTel,
            eposta: erpCari.cari_EMail,
            vergi_dairesi: erpCari.cari_vdaire_adi,
            vergi_no: erpCari.cari_vdaire_no,
            cari_tipi: erpCari.cari_baglanti_tipi === 1 ? 'Tedarikçi' : 'Müşteri',
            guncelleme_tarihi: new Date(),
            kaynak: 'erp'
        }));

        const columns = ['cari_kodu', 'cari_adi', 'telefon', 'eposta', 'vergi_dairesi', 'vergi_no', 'cari_tipi', 'guncelleme_tarihi', 'kaynak'];
        const updateColumns = ['cari_adi', 'telefon', 'eposta', 'vergi_dairesi', 'vergi_no', 'cari_tipi', 'guncelleme_tarihi', 'kaynak'];

        const { query, values } = this.buildBulkUpsertQuery(
            'cari_hesaplar',
            columns,
            rows,
            'cari_kodu',
            updateColumns
        );

        await pgService.query(query, values);
    }

    buildBulkUpsertQuery(tableName, columns, rows, conflictTarget, updateColumns) {
        const placeholders = [];
        const values = [];
        let paramIndex = 1;

        rows.forEach(row => {
            const rowPlaceholders = [];
            columns.forEach(col => {
                rowPlaceholders.push(`$${paramIndex++}`);
                values.push(row[col]);
            });
            placeholders.push(`(${rowPlaceholders.join(', ')})`);
        });

        let query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;

        if (conflictTarget) {
            query += ` ON CONFLICT (${conflictTarget}) DO UPDATE SET `;
            query += updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
        }

        return { query, values };
    }

    async syncSingleCariToWeb(erpCari) {
        const webCari = {
            cari_kodu: erpCari.cari_kod,
            cari_adi: (erpCari.cari_unvan1 + ' ' + (erpCari.cari_unvan2 || '')).trim(),
            telefon: erpCari.cari_CepTel,
            eposta: erpCari.cari_EMail,
            vergi_dairesi: erpCari.cari_vdaire_adi,
            vergi_no: erpCari.cari_vdaire_no,
            cari_tipi: erpCari.cari_baglanti_tipi === 1 ? 'Tedarikçi' : 'Müşteri',
            guncelleme_tarihi: new Date(),
            kaynak: 'erp'
        };

        // Upsert
        await pgService.query(`
      INSERT INTO cari_hesaplar (
        cari_kodu, cari_adi, telefon, eposta, vergi_dairesi, vergi_no, cari_tipi, guncelleme_tarihi, kaynak
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (cari_kodu) 
      DO UPDATE SET 
        cari_adi = EXCLUDED.cari_adi,
        telefon = EXCLUDED.telefon,
        eposta = EXCLUDED.eposta,
        vergi_dairesi = EXCLUDED.vergi_dairesi,
        vergi_no = EXCLUDED.vergi_no,
        cari_tipi = EXCLUDED.cari_tipi,
        guncelleme_tarihi = EXCLUDED.guncelleme_tarihi,
        kaynak = EXCLUDED.kaynak
    `, [
            webCari.cari_kodu, webCari.cari_adi, webCari.telefon, webCari.eposta,
            webCari.vergi_dairesi, webCari.vergi_no, webCari.cari_tipi, webCari.guncelleme_tarihi, webCari.kaynak
        ]);
    }

    /**
    * Web'den ERP'ye cari senkronizasyonu
    * @param {Date|null} lastSyncTime - Son senkronizasyon zamanı
    * @returns {Promise<number>} İşlenen kayıt sayısı
    */
    async syncFromWeb(lastSyncTime = null) {
        try {
            const direction = 'web_to_erp';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Web -> ERP Cari senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            let whereClause = 'WHERE guncelleme_tarihi > $1';
            let params = [lastSyncTime || new Date(0)];

            const query = `
                SELECT 
                    cari_kodu, cari_adi, telefon, eposta, 
                    vergi_dairesi, vergi_no, cari_tipi, 
                    adres, il, ilce, guncelleme_tarihi
                FROM cari_hesaplar
                ${whereClause}
                ORDER BY guncelleme_tarihi
            `;

            const changedRecords = await pgService.query(query, params);
            logger.info(`${changedRecords.length} değişen cari bulundu (Web)`);

            let processedCount = 0;
            let errorCount = 0;

            for (const webCari of changedRecords) {
                try {
                    await this.syncToERP(webCari);
                    processedCount++;
                } catch (error) {
                    errorCount++;
                    logger.error(`Cari ERP senkronizasyon hatası (${webCari.cari_kodu}):`, error.message);
                }
            }

            await syncStateService.updateSyncTime(
                this.tableName,
                direction,
                processedCount,
                errorCount === 0,
                errorCount > 0 ? `${errorCount} hata oluştu` : null
            );

            logger.info(`Web -> ERP Cari senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Web -> ERP Cari senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'web_to_erp', 0, false, error.message);
            throw error;
        }
    }

    /**
     * Tek bir cari kaydını ERP'ye senkronize eder
     * @param {Object} webCari - Web cari kaydı
     */
    async syncToERP(webCari) {
        try {
            // Cari tipi belirle (Tedarikçi -> 1, Diğerleri/Müşteri -> 0)
            const baglantiTipi = webCari.cari_tipi === 'Tedarikçi' ? 1 : 0;
            const updateDate = new Date().toISOString().replace('T', ' ').substring(0, 23);

            // ERP'de kontrol et
            const erpCariResult = await mssqlService.query(
                `SELECT cari_RECno FROM CARI_HESAPLAR WHERE cari_kod = @cariKod`,
                { cariKod: webCari.cari_kodu }
            );

            if (erpCariResult.length === 0) {
                // YENİ CARI - INSERT
                logger.info(`Yeni cari ERP'ye ekleniyor: ${webCari.cari_kodu}`);

                // İsim ayrıştırma (Basitçe)
                const isimParcalari = (webCari.cari_adi || '').split(' ');
                const unvan1 = webCari.cari_adi ? webCari.cari_adi.substring(0, 50) : '';
                const unvan2 = webCari.cari_adi && webCari.cari_adi.length > 50 ? webCari.cari_adi.substring(50, 100) : '';

                const insertResult = await mssqlService.query(`
                    INSERT INTO CARI_HESAPLAR (
                        cari_RECid_DBCno, cari_RECid_RECno, cari_SpecRECno, cari_iptal, cari_fileid,
                        cari_hidden, cari_kilitli, cari_degisti, cari_checksum,
                        cari_create_user, cari_create_date, cari_lastup_user, cari_lastup_date,
                        cari_special1, cari_special2, cari_special3,
                        cari_kod, cari_unvan1, cari_unvan2, cari_hareket_tipi, cari_baglanti_tipi,
                        cari_vdaire_adi, cari_vdaire_no, cari_CepTel, cari_EMail,
                        cari_adres_sokak, cari_adres_il, cari_adres_ilce
                    ) VALUES (
                        0, 0, 0, 0, 31,
                        0, 0, 0, 0,
                        1, @createDate, 1, @lastupDate,
                        N'', N'', N'',
                        @cariKod, @cariUnvan1, @cariUnvan2, 0, @baglantiTipi,
                        @vdaireAdi, @vdaireNo, @cepTel, @email,
                        @adres, @il, @ilce
                    );
                    SELECT SCOPE_IDENTITY() AS cari_RECno;
                `, {
                    createDate: updateDate,
                    lastupDate: updateDate,
                    cariKod: webCari.cari_kodu,
                    cariUnvan1: unvan1,
                    cariUnvan2: unvan2,
                    baglantiTipi: baglantiTipi,
                    vdaireAdi: webCari.vergi_dairesi || '',
                    vdaireNo: webCari.vergi_no || '',
                    cepTel: webCari.telefon || '',
                    email: webCari.eposta || '',
                    adres: webCari.adres || '',
                    il: webCari.il || '',
                    ilce: webCari.ilce || ''
                });

                if (insertResult && insertResult[0]) {
                    const cariRecno = insertResult[0].cari_RECno;
                    await mssqlService.query(
                        `UPDATE CARI_HESAPLAR SET cari_RECid_RECno = @recno WHERE cari_RECno = @recno`,
                        { recno: cariRecno }
                    );
                    logger.info(`✓ Yeni cari ERP'ye eklendi: ${webCari.cari_kodu} (RECno: ${cariRecno})`);
                }

            } else {
                // MEVCUT CARI - UPDATE
                const recNo = erpCariResult[0].cari_RECno;

                await mssqlService.query(
                    `UPDATE CARI_HESAPLAR SET 
                        cari_lastup_date = @lastupDate,
                        cari_baglanti_tipi = @baglantiTipi,
                        cari_unvan1 = @cariUnvan1,
                        cari_vdaire_adi = @vdaireAdi,
                        cari_vdaire_no = @vdaireNo,
                        cari_CepTel = @cepTel,
                        cari_EMail = @email
                    WHERE cari_RECno = @recNo`,
                    {
                        lastupDate: updateDate,
                        baglantiTipi: baglantiTipi,
                        cariUnvan1: webCari.cari_adi ? webCari.cari_adi.substring(0, 50) : '',
                        vdaireAdi: webCari.vergi_dairesi || '',
                        vdaireNo: webCari.vergi_no || '',
                        cepTel: webCari.telefon || '',
                        email: webCari.eposta || '',
                        recNo: recNo
                    }
                );
                logger.debug(`Cari güncellendi: ${webCari.cari_kodu} (Tip: ${baglantiTipi})`);
            }

        } catch (error) {
            logger.error(`Cari ERP senkronizasyon hatası (${webCari.cari_kodu}):`, error);
            throw error;
        }
    }
}

module.exports = new CariProcessor();
