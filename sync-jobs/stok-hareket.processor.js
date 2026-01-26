const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class StokHareketProcessor {
    constructor() {
        this.tableName = 'STOK_HAREKETLERI';
        this.BATCH_SIZE = 2000;
    }

    // ERP vergi kodunu (sth_vergi_pntr) KDV oranına çevir
    mapVergiPntrToKdvOrani(vergiPntr) {
        const mapping = {
            0: 0,   // Tanımsız Vergi
            1: 0,   // YOK
            2: 1,   // VERGİ %1
            3: 10,  // VERGİ %10
            4: 20,  // VERGİ %20
            5: 26,  // VERGİ %26
            6: 0    // VERGİ ÖZEL MATRAJ
        };
        return mapping[vergiPntr] !== undefined ? mapping[vergiPntr] : 0;
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            // Web tarafındaki tablo boş mu kontrol et
            const countResult = await pgService.query('SELECT COUNT(*) as count FROM stok_hareketleri');
            const isWebTableEmpty = parseInt(countResult[0].count) === 0;

            if (isWebTableEmpty) {
                logger.info('Web tarafındaki stok_hareketleri tablosu boş, TAM senkronizasyon zorlanıyor.');
                lastSyncTime = null;
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Stok Hareket senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            // Tüm kayıtları çek (Bellek sorunu olursa burası da batch yapılmalı ama 64k kayıt sorun olmaz)
            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen stok hareket bulundu. Bulk işlem başlıyor...`);

            if (changedRecords.length === 0) {
                return 0;
            }

            // 1. Gerekli ID'leri önbelleğe al (Stok ve Cari)
            logger.info('Stok ve Cari ID eşleşmeleri hazırlanıyor...');
            const stokKodlari = [...new Set(changedRecords.map(r => r.sth_stok_kod).filter(k => k))];
            const cariKodlari = [...new Set(changedRecords.map(r => r.sth_cari_kodu).filter(k => k))];

            // Stok ID'lerini çek
            let stokMap = new Map();
            if (stokKodlari.length > 0) {
                // Çok fazla parametre hatası almamak için stokları da parça parça çekelim
                for (let i = 0; i < stokKodlari.length; i += 5000) {
                    const chunk = stokKodlari.slice(i, i + 5000);
                    const stoklar = await pgService.query('SELECT id, stok_kodu FROM stoklar WHERE stok_kodu = ANY($1)', [chunk]);
                    stoklar.forEach(s => stokMap.set(s.stok_kodu, s.id));
                }
            }

            // Cari ID'lerini çek
            let cariMap = new Map();
            if (cariKodlari.length > 0) {
                for (let i = 0; i < cariKodlari.length; i += 5000) {
                    const chunk = cariKodlari.slice(i, i + 5000);
                    const cariler = await pgService.query('SELECT id, cari_kodu FROM cari_hesaplar WHERE cari_kodu = ANY($1)', [chunk]);
                    cariler.forEach(c => cariMap.set(c.cari_kodu, c.id));
                }
            }
            logger.info(`Eşleşmeler hazır: ${stokMap.size} stok, ${cariMap.size} cari.`);

            // 2. Batch İşleme
            let processedCount = 0;
            let errorCount = 0;

            for (let i = 0; i < changedRecords.length; i += this.BATCH_SIZE) {
                const batch = changedRecords.slice(i, i + this.BATCH_SIZE);
                try {
                    await this.processBatch(batch, stokMap, cariMap);
                    processedCount += batch.length;
                    logger.info(`  ${processedCount}/${changedRecords.length} hareket işlendi...`);
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

            logger.info(`Stok Hareket senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Stok Hareket senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND sth_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        const query = `
      SELECT 
        sth_RECno, sth_tarih, sth_belge_tarih,
        sth_evrakno_sira, sth_evrakno_seri,
        sth_stok_kod, sth_cari_kodu,
        sth_miktar, sth_tutar, sth_vergi, sth_vergi_pntr,
        sth_tip, sth_cins, sth_normal_iade, sth_evraktip,
        sth_fat_recid_recno,
        sth_iskonto1, sth_iskonto2, sth_iskonto3, sth_iskonto4, sth_iskonto5, sth_iskonto6,
        sth_isemri_gider_kodu,
        sth_lastup_date
      FROM STOK_HAREKETLERI
      ${whereClause}
      ORDER BY sth_lastup_date
    `;

        return await mssqlService.query(query, params);
    }

    async processBatch(batch, stokMap, cariMap) {
        const rows = [];

        for (const erpHareket of batch) {
            const stokId = stokMap.get(erpHareket.sth_stok_kod);
            // Stok bulunamazsa hareketi atla veya logla (burada atlıyoruz ama istenirse null ile de gidilebilir)
            if (!stokId) continue;

            const cariId = cariMap.get(erpHareket.sth_cari_kodu) || null;
            const hareketTipi = erpHareket.sth_tip === 0 ? 'giris' : 'cikis';

            let belgeTipi = 'fatura';
            // Sayım fişleri (10)
            if (erpHareket.sth_cins === 10) {
                belgeTipi = 'sayim';
            }

            rows.push({
                erp_recno: erpHareket.sth_RECno,
                stok_id: stokId,
                cari_hesap_id: cariId,
                islem_tarihi: erpHareket.sth_tarih,
                belge_no: (erpHareket.sth_evrakno_seri || '') + (erpHareket.sth_evrakno_sira || ''),
                miktar: erpHareket.sth_miktar,
                toplam_tutar: erpHareket.sth_tutar,
                kdv_orani: this.mapVergiPntrToKdvOrani(erpHareket.sth_vergi_pntr || 0),
                kdv_tutari: erpHareket.sth_vergi || 0,
                guncelleme_tarihi: new Date(),
                fatura_seri_no: erpHareket.sth_evrakno_seri,
                fatura_sira_no: erpHareket.sth_evrakno_sira,
                fat_recid_recno: erpHareket.sth_fat_recid_recno,
                hareket_tipi: hareketTipi,
                belge_tipi: belgeTipi,
                onceki_miktar: 0,
                sonraki_miktar: 0,
                iskonto1: erpHareket.sth_iskonto1 || 0,
                iskonto2: erpHareket.sth_iskonto2 || 0,
                iskonto3: erpHareket.sth_iskonto3 || 0,
                iskonto4: erpHareket.sth_iskonto4 || 0,
                iskonto5: erpHareket.sth_iskonto5 || 0,
                iskonto6: erpHareket.sth_iskonto6 || 0,
                sth_isemri_gider_kodu: erpHareket.sth_isemri_gider_kodu || null
            });
        }

        if (rows.length === 0) return;

        const columns = [
            'erp_recno', 'stok_id', 'cari_hesap_id', 'islem_tarihi', 'belge_no',
            'miktar', 'toplam_tutar', 'kdv_orani', 'kdv_tutari', 'guncelleme_tarihi', 'fatura_seri_no',
            'fatura_sira_no', 'fat_recid_recno', 'hareket_tipi', 'belge_tipi', 'onceki_miktar', 'sonraki_miktar',
            'iskonto1', 'iskonto2', 'iskonto3', 'iskonto4', 'iskonto5', 'iskonto6', 'sth_isemri_gider_kodu'
        ];

        const updateColumns = [
            'stok_id', 'cari_hesap_id', 'islem_tarihi', 'belge_no',
            'miktar', 'toplam_tutar', 'kdv_orani', 'kdv_tutari', 'guncelleme_tarihi', 'fatura_seri_no',
            'fatura_sira_no', 'fat_recid_recno', 'hareket_tipi', 'belge_tipi', 'onceki_miktar', 'sonraki_miktar',
            'iskonto1', 'iskonto2', 'iskonto3', 'iskonto4', 'iskonto5', 'iskonto6', 'sth_isemri_gider_kodu'
        ];

        const { query, values } = this.buildBulkUpsertQuery(
            'stok_hareketleri',
            columns,
            rows,
            'erp_recno',
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


    async syncToERP(webStokHareket) {
        try {
            // Check if already synced
            if (webStokHareket.erp_recno) {
                logger.warn(`Bu stok hareketi zaten ERP'de var: ${webStokHareket.id} (ERP RECno: ${webStokHareket.erp_recno})`);
                return;
            }

            // Satış, fatura ve manuel tipi stok hareketleri ERP'ye fatura olarak yazıldığında
            // otomatik oluşuyor veya manuel düzenleme olduğundan, bunları atlıyoruz
            if (webStokHareket.belge_tipi === 'satis' || webStokHareket.belge_tipi === 'fatura' || webStokHareket.belge_tipi === 'manuel') {
                logger.info(`Stok hareketi atlandı (belge_tipi=${webStokHareket.belge_tipi}): ${webStokHareket.id}`);
                return;
            }

            // Get Stok Kodu
            const stokRes = await pgService.query('SELECT stok_kodu FROM stoklar WHERE id = $1', [webStokHareket.stok_id]);
            if (stokRes.length === 0) {
                throw new Error(`Stok bulunamadı Web ID: ${webStokHareket.stok_id}`);
            }
            const stokKod = stokRes[0].stok_kodu;

            if (webStokHareket.belge_tipi === 'sayim') {
                // Son sıra numarasını bul (SAYIM_SONUCLARI için)
                let satirNo = 0;
                // Transformer tarih stringini oluşturmadan önce biz burada oluşturup sorguda kullanalım
                const date = new Date(webStokHareket.islem_tarihi);
                const tarihStr = date.toISOString().slice(0, 10).replace(/-/g, '');
                const evrakNo = webStokHareket.fatura_sira_no || 1;
                const depoNo = 1;

                const maxSeq = await mssqlService.query(
                    `SELECT MAX(sym_satirno) as max_seq FROM SAYIM_SONUCLARI WHERE sym_tarihi = @tarih AND sym_depono = @depo AND sym_evrakno = @evrak`,
                    { tarih: tarihStr, depo: depoNo, evrak: evrakNo }
                );
                satirNo = (maxSeq[0].max_seq || 0) + 1;

                // sayilan_urunler tablosundan sayilan_miktar değerini çek
                // referans_id üzerinden veya stok_id + tarih ile eşleştir
                let sayilanMiktar = webStokHareket.miktar; // Varsayılan olarak mevcut miktar

                // Önce referans_id ile dene (eğer varsa)
                if (webStokHareket.referans_id) {
                    const sayilanUrunRes = await pgService.query(
                        `SELECT sayilan_miktar FROM sayilan_urunler WHERE id = $1`,
                        [webStokHareket.referans_id]
                    );
                    if (sayilanUrunRes.length > 0 && sayilanUrunRes[0].sayilan_miktar !== null) {
                        sayilanMiktar = parseFloat(sayilanUrunRes[0].sayilan_miktar);
                        logger.info(`Sayım için sayilan_miktar referans_id ile bulundu: ${sayilanMiktar}`);
                    }
                }

                // referans_id ile bulunamadıysa stok_id + tarih ile dene
                if (sayilanMiktar === webStokHareket.miktar) {
                    const sayilanUrunByStok = await pgService.query(
                        `SELECT sayilan_miktar FROM sayilan_urunler 
                         WHERE stok_id = $1 
                         AND DATE(sayim_tarihi) = DATE($2)
                         ORDER BY sayim_tarihi DESC LIMIT 1`,
                        [webStokHareket.stok_id, webStokHareket.islem_tarihi]
                    );
                    if (sayilanUrunByStok.length > 0 && sayilanUrunByStok[0].sayilan_miktar !== null) {
                        sayilanMiktar = parseFloat(sayilanUrunByStok[0].sayilan_miktar);
                        logger.info(`Sayım için sayilan_miktar stok_id+tarih ile bulundu: ${sayilanMiktar}`);
                    }
                }

                // webStokHareket'e sayilan_miktar değerini ekle (transformer'a gönderilecek)
                webStokHareket.sayilan_miktar = sayilanMiktar;

                // SAYIM_SONUCLARI tablosuna yaz
                const transformer = require('../transformers/sayim.transformer');
                const erpData = await transformer.transformToERP(webStokHareket, stokKod, satirNo);
                const symRecNo = await this.insertToSayimSonuclari(erpData);

                // Update Web with ERP RecNo and Document Numbers
                await pgService.query(
                    'UPDATE stok_hareketleri SET erp_recno = $1, fatura_sira_no = $2 WHERE id = $3',
                    [-symRecNo, erpData.sym_evrakno, webStokHareket.id]
                );
                logger.info(`Sayım fişi SAYIM_SONUCLARI'na gönderildi. ID: ${webStokHareket.id} -> RecNo: ${symRecNo} (Saved as -${symRecNo}) (Satır: ${satirNo}, Evrak: ${erpData.sym_evrakno})`);

            } else {
                // STOK_HAREKETLERI tablosuna yaz (Eski logic)

                // Son sıra numarasını bul
                let satirNo = 0;
                if (webStokHareket.fatura_seri_no) {
                    const maxSeq = await mssqlService.query(
                        `SELECT MAX(sth_satirno) as max_seq FROM STOK_HAREKETLERI WHERE sth_evrakno_seri = @seri AND sth_evrakno_sira = @sira`,
                        { seri: webStokHareket.fatura_seri_no, sira: webStokHareket.fatura_sira_no || 0 }
                    );
                    satirNo = (maxSeq[0].max_seq || 0) + 1;
                }

                const transformer = require('../transformers/stok-hareket.transformer');
                const erpData = await transformer.transformToERP(webStokHareket, stokKod, satirNo);

                // Insert to MSSQL
                const sthRecNo = await this.insertToERP(erpData);

                // Update Web with ERP RecNo and Document Numbers
                const updateSeri = erpData.sth_evrakno_seri;
                const updateSira = erpData.sth_evrakno_sira;

                await pgService.query(
                    'UPDATE stok_hareketleri SET erp_recno = $1, fatura_seri_no = $2, fatura_sira_no = $3, belge_no = $4 WHERE id = $5',
                    [sthRecNo, updateSeri, updateSira, updateSeri + updateSira, webStokHareket.id]
                );
                logger.info(`Stok hareketi ERP'ye gönderildi. ID: ${webStokHareket.id} -> RecNo: ${sthRecNo}, Belge: ${updateSeri}${updateSira}`);
            }

        } catch (error) {
            logger.error('Stok Hareket ERP Sync Hatası:', error);
            throw error;
        }
    }

    async insertToSayimSonuclari(data) {
        return await mssqlService.transaction(async (transaction) => {
            const request = transaction.request();

            Object.keys(data).forEach(key => {
                request.input(key, data[key]);
            });

            const result = await request.query(`
                INSERT INTO SAYIM_SONUCLARI (
                    sym_RECid_DBCno, sym_RECid_RECno, sym_SpecRECno, sym_iptal, 
                    sym_fileid, sym_hidden, sym_kilitli, sym_degisti, sym_checksum,
                    sym_create_user, sym_create_date, sym_lastup_user, sym_lastup_date,
                    sym_special1, sym_special2, sym_special3,
                    sym_tarihi, sym_depono, sym_evrakno,
                    sym_satirno, sym_Stokkodu,
                    sym_reyonkodu, sym_koridorkodu, sym_rafkodu,
                    sym_miktar1, sym_miktar2, sym_miktar3, sym_miktar4, sym_miktar5,
                    sym_birim_pntr, sym_barkod, sym_renkno, sym_bedenno,
                    sym_parti_kodu, sym_lot_no, sym_serino
                ) VALUES (
                    @sym_RECid_DBCno, 0, @sym_SpecRECno, @sym_iptal,
                    @sym_fileid, @sym_hidden, @sym_kilitli, @sym_degisti, @sym_checksum,
                    @sym_create_user, @sym_create_date, @sym_lastup_user, @sym_lastup_date,
                    @sym_special1, @sym_special2, @sym_special3,
                    @sym_tarihi, @sym_depono, @sym_evrakno,
                    @sym_satirno, @sym_Stokkodu,
                    @sym_reyonkodu, @sym_koridorkodu, @sym_rafkodu,
                    @sym_miktar1, @sym_miktar2, @sym_miktar3, @sym_miktar4, @sym_miktar5,
                    @sym_birim_pntr, @sym_barkod, @sym_renkno, @sym_bedenno,
                    @sym_parti_kodu, @sym_lot_no, @sym_serino
                );
                SELECT SCOPE_IDENTITY() AS sym_RECno;
            `);

            const symRecNo = result.recordset[0].sym_RECno;

            // RECid_RECno güncelle
            await mssqlService.updateRecIdRecNo('SAYIM_SONUCLARI', 'sym_RECno', symRecNo, transaction);

            return symRecNo;
        });
    }

    async insertToERP(data) {
        return await mssqlService.transaction(async (transaction) => {
            const request = transaction.request();

            // Parametreleri ekle
            Object.keys(data).forEach(key => {
                request.input(key, data[key]);
            });

            // Default values if missing
            if (!data.hasOwnProperty('sth_create_user')) request.input('sth_create_user', 1);
            if (!data.hasOwnProperty('sth_lastup_user')) request.input('sth_lastup_user', 1);

            const result = await request.query(`
                INSERT INTO STOK_HAREKETLERI (
                    sth_stok_kod, sth_miktar, sth_tutar, sth_vergi, sth_vergi_pntr,
                    sth_iskonto1, sth_iskonto2, sth_iskonto3, sth_iskonto4, sth_iskonto5, sth_iskonto6,
                    sth_tarih, sth_belge_tarih, sth_cari_kodu,
                    sth_cikis_depo_no, sth_giris_depo_no,
                    sth_tip, sth_cins, sth_normal_iade, sth_evraktip,
                    sth_evrakno_sira, sth_evrakno_seri,
                    sth_create_user, sth_lastup_user, sth_create_date, sth_lastup_date,
                    sth_firmano, sth_subeno,
                    sth_har_doviz_cinsi, sth_har_doviz_kuru, sth_alt_doviz_kuru,
                    sth_stok_doviz_cinsi, sth_stok_doviz_kuru,
                    sth_RECid_DBCno, sth_RECid_RECno, sth_SpecRECno, sth_iptal,
                    sth_fileid, sth_hidden, sth_kilitli, sth_degisti, sth_checksum,
                    sth_satirno, sth_belge_no, sth_fis_tarihi, sth_malkbl_sevk_tarihi,
                    sth_special1, sth_special2, sth_special3,
                    sth_isk_mas1, sth_isk_mas2, sth_isk_mas3, sth_isk_mas4, sth_isk_mas5,
                    sth_isk_mas6, sth_isk_mas7, sth_isk_mas8, sth_isk_mas9, sth_isk_mas10,
                    sth_sat_iskmas1, sth_sat_iskmas2, sth_sat_iskmas3, sth_sat_iskmas4, sth_sat_iskmas5,
                    sth_sat_iskmas6, sth_sat_iskmas7, sth_sat_iskmas8, sth_sat_iskmas9, sth_sat_iskmas10,
                    sth_pos_satis, sth_promosyon_fl, sth_cari_cinsi, sth_cari_grup_no,
                    sth_isemri_gider_kodu, sth_plasiyer_kodu, sth_miktar2, sth_birim_pntr,
                    sth_masraf1, sth_masraf2, sth_masraf3, sth_masraf4,
                    sth_masraf_vergi_pntr, sth_masraf_vergi, sth_netagirlik, sth_odeme_op,
                    sth_aciklama, sth_sip_recid_dbcno, sth_sip_recid_recno, sth_fat_recid_dbcno, 
                    sth_fat_recid_recno,
                    sth_cari_srm_merkezi, sth_stok_srm_merkezi, sth_fis_sirano, sth_vergisiz_fl,
                    sth_maliyet_ana, sth_maliyet_alternatif, sth_maliyet_orjinal, sth_adres_no,
                    sth_parti_kodu, sth_lot_no, sth_kons_recid_dbcno, sth_kons_recid_recno,
                    sth_proje_kodu, sth_exim_kodu, sth_otv_pntr, sth_otv_vergi,
                    sth_brutagirlik, sth_disticaret_turu, sth_otvtutari, sth_otvvergisiz_fl,
                    sth_oiv_pntr, sth_oiv_vergi, sth_oivvergisiz_fl, sth_fiyat_liste_no,
                    sth_oivtutari, sth_Tevkifat_turu, sth_nakliyedeposu, sth_nakliyedurumu,
                    sth_yetkili_recid_dbcno, sth_yetkili_recid_recno, sth_taxfree_fl, sth_ilave_edilecek_kdv
                )
                VALUES (
                    @sth_stok_kod, @sth_miktar, @sth_tutar, @sth_vergi, @sth_vergi_pntr,
                    @sth_iskonto1, @sth_iskonto2, @sth_iskonto3, @sth_iskonto4, @sth_iskonto5, @sth_iskonto6,
                    @sth_tarih, @sth_belge_tarih, @sth_cari_kodu,
                    @sth_cikis_depo_no, @sth_giris_depo_no,
                    @sth_tip, @sth_cins, @sth_normal_iade, @sth_evraktip,
                    @sth_evrakno_sira, @sth_evrakno_seri,
                    @sth_create_user, @sth_lastup_user, GETDATE(), GETDATE(),
                    @sth_firmano, @sth_subeno,
                    @sth_har_doviz_cinsi, @sth_har_doviz_kuru, @sth_alt_doviz_kuru,
                    @sth_stok_doviz_cinsi, @sth_stok_doviz_kuru,
                    @sth_RECid_DBCno, 0, @sth_SpecRECno, @sth_iptal,
                    @sth_fileid, @sth_hidden, @sth_kilitli, @sth_degisti, @sth_checksum,
                    @sth_satirno, @sth_belge_no, @sth_tarih, @sth_tarih,
                    @sth_special1, @sth_special2, @sth_special3,
                    @sth_isk_mas1, @sth_isk_mas2, @sth_isk_mas3, @sth_isk_mas4, @sth_isk_mas5,
                    @sth_isk_mas6, @sth_isk_mas7, @sth_isk_mas8, @sth_isk_mas9, @sth_isk_mas10,
                    @sth_sat_iskmas1, @sth_sat_iskmas2, @sth_sat_iskmas3, @sth_sat_iskmas4, @sth_sat_iskmas5,
                    @sth_sat_iskmas6, @sth_sat_iskmas7, @sth_sat_iskmas8, @sth_sat_iskmas9, @sth_sat_iskmas10,
                    @sth_pos_satis, @sth_promosyon_fl, @sth_cari_cinsi, @sth_cari_grup_no,
                    @sth_isemri_gider_kodu, '', @sth_miktar2, @sth_birim_pntr,
                    0, 0, 0, 0,
                    0, 0, 0, 0,
                    @sth_aciklama, 0, 0, 0, 
                    0,
                    0, 0, 0, 0,
                    @sth_maliyet_ana, 0, 0, 0,
                    '', 0, 0, 0,
                    '', '', 0, 0,
                    0, 0, 0, 0,
                    0, 0, 0, 0,
                    0, 0, 0, 0,
                    0, 0, 0, 0
                );
                SELECT SCOPE_IDENTITY() AS sth_RECno;
            `);

            const sthRecno = result.recordset[0].sth_RECno;
            logger.info(`ERP Insert Result - sth_RECno: ${sthRecno} (Type: ${typeof sthRecno})`);

            if (!sthRecno) {
                logger.error('ERP Insert returned invalid sthRecno:', sthRecno);
                throw new Error('ERP insert failed to return valid SCOPE_IDENTITY');
            }

            // RECid_RECno güncelle
            await mssqlService.updateRecIdRecNo('STOK_HAREKETLERI', 'sth_RECno', sthRecno, transaction);

            return sthRecno;
        });
    }

}

module.exports = new StokHareketProcessor();
