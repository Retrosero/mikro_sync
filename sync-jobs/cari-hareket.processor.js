const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class CariHareketProcessor {
    constructor() {
        this.tableName = 'CARI_HESAP_HAREKETLERI';
        this.BATCH_SIZE = 4000;
    }

    // ERP'den gelen hareket bilgilerine göre hareket tipini belirle
    mapHareketTipi(cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_iade, cha_tpoz) {
        // cha_tip: 0=Borç (Satış), 1=Alacak (Alış/Tahsilat)
        // cha_normal_iade: 0=Normal, 1=İade
        // cha_evrak_tip: 63=Satış Faturası, 0=Alış Faturası, 1=Tahsilat
        // cha_cinsi: 0=Nakit, 1=Çek, 2=Senet, 6=Fatura, 17=Havale, 19=Kredi Kartı

        // Tahsilat kontrolü - cha_evrak_tip = 1 ve cha_tip = 1
        if (cha_evrak_tip === 1 && cha_tip === 1) {
            // Tahsilat türünü cha_cinsi'ye göre belirle
            switch (cha_cinsi) {
                case 0:
                    return 'Tahsilat - Nakit';
                case 1:
                    return 'Tahsilat - Çek';
                case 2:
                    return 'Tahsilat - Senet';
                case 17:
                    return 'Tahsilat - Havale';
                case 19:
                    return 'Tahsilat - Kredi Kartı';
                default:
                    return 'Tahsilat';
            }
        }

        if (cha_evrak_tip === 63) {
            // Satış işlemleri
            if (cha_normal_iade === 1) {
                return 'Satış İade';
            } else {
                return 'Satış';
            }
        } else if (cha_evrak_tip === 0 || cha_tip === 1) {
            // Alış işlemleri
            if (cha_normal_iade === 1) {
                return 'İade';
            } else {
                return 'Alış';
            }
        }

        // Varsayılan: cha_tip'e göre
        return cha_tip === 0 ? 'Satış' : 'Alış';
    }

    // Ödeme yerini (hareket türünü) belirle
    mapHareketTuru(cha_tpoz, cha_cari_cins) {
        // cha_tpoz: 0=Açık Hesap, 1=Nakit/Kasa/Banka
        // cha_cari_cins: 0=Normal, 2=Banka, 4=Kasa

        if (cha_tpoz === 0) {
            return 'Açık Hesap';
        } else if (cha_tpoz === 1) {
            if (cha_cari_cins === 4) {
                return 'Kasa';
            } else if (cha_cari_cins === 2) {
                return 'Banka';
            } else {
                return 'Kasa'; // Varsayılan
            }
        }

        return 'Açık Hesap'; // Varsayılan
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            // Web tarafındaki tablo boş mu kontrol et
            const countResult = await pgService.query('SELECT COUNT(*) as count FROM cari_hesap_hareketleri');
            const isWebTableEmpty = parseInt(countResult[0].count) === 0;

            if (isWebTableEmpty) {
                logger.info('Web tarafındaki cari_hesap_hareketleri tablosu boş, TAM senkronizasyon zorlanıyor.');
                lastSyncTime = null;
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Cari Hareket senkronizasyonu başlıyor(${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen cari hareket bulundu.Bulk işlem başlıyor...`);

            if (changedRecords.length === 0) {
                return 0;
            }

            // 1. Gerekli ID'leri önbelleğe al (Cari)
            logger.info('Cari ID eşleşmeleri hazırlanıyor...');
            const cariKodlari = [...new Set(changedRecords.map(r => r.cha_kod).filter(k => k))];

            let cariMap = new Map();
            if (cariKodlari.length > 0) {
                for (let i = 0; i < cariKodlari.length; i += 5000) {
                    const chunk = cariKodlari.slice(i, i + 5000);
                    const cariler = await pgService.query('SELECT id, cari_kodu FROM cari_hesaplar WHERE cari_kodu = ANY($1)', [chunk]);
                    cariler.forEach(c => cariMap.set(c.cari_kodu, c.id));
                }
            }
            logger.info(`Eşleşmeler hazır: ${cariMap.size} cari.`);

            // 2. Batch İşleme
            let processedCount = 0;
            let errorCount = 0;

            for (let i = 0; i < changedRecords.length; i += this.BATCH_SIZE) {
                const batch = changedRecords.slice(i, i + this.BATCH_SIZE);
                try {
                    await this.processBatch(batch, cariMap);
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

            logger.info(`Cari Hareket senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Cari Hareket senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND cha_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        const query = `
      SELECT 
        cha_RECno, cha_tarihi, cha_belge_tarih,
        cha_evrakno_sira, cha_evrakno_seri,
        cha_kod, cha_ciro_cari_kodu, cha_meblag, cha_aratoplam,
        cha_aciklama, cha_cinsi, cha_evrak_tip, cha_tip, cha_normal_Iade as cha_normal_iade,
        cha_kasa_hizkod, cha_tpoz, cha_cari_cins,
        cha_lastup_date
      FROM CARI_HESAP_HAREKETLERI
      ${whereClause}
      ORDER BY cha_lastup_date
    `;

        return await mssqlService.query(query, params);
    }

    async processBatch(batch, cariMap) {
        const rows = [];

        // Debug için ilk kaydı logla
        if (batch.length > 0) {
            const first = batch[0];
            // Sadece bir kere loglamak için (veya her batch'te bir kere)
            logger.info('Sample ERP Hareket:', {
                recno: first.cha_RECno,
                kasa_hizkod: first.cha_kasa_hizkod,
                keys: Object.keys(first)
            });
        }

        for (const erpHareket of batch) {
            // cha_kod='001' ise cha_ciro_cari_kodu'nu kullan (kasa/banka işlemleri)
            const cariKod = erpHareket.cha_kod === '001' && erpHareket.cha_ciro_cari_kodu
                ? erpHareket.cha_ciro_cari_kodu
                : erpHareket.cha_kod;

            const cariId = cariMap.get(cariKod);
            if (!cariId) continue;

            const hareketTipi = this.mapHareketTipi(
                erpHareket.cha_evrak_tip,
                erpHareket.cha_tip,
                erpHareket.cha_cinsi,
                erpHareket.cha_normal_iade,
                erpHareket.cha_tpoz
            );

            const hareketTuru = this.mapHareketTuru(
                erpHareket.cha_tpoz,
                erpHareket.cha_cari_cins
            );

            const belgeTipi = 'fatura';

            rows.push({
                erp_recno: erpHareket.cha_RECno,
                cari_hesap_id: cariId,
                islem_tarihi: erpHareket.cha_tarihi,
                belge_no: (erpHareket.cha_evrakno_seri || '') + (erpHareket.cha_evrakno_sira || ''),
                tutar: erpHareket.cha_meblag,
                aciklama: erpHareket.cha_aciklama,
                guncelleme_tarihi: new Date(),
                fatura_seri_no: erpHareket.cha_evrakno_seri,
                fatura_sira_no: erpHareket.cha_evrakno_sira,
                hareket_tipi: hareketTipi,
                hareket_turu: hareketTuru,
                belge_tipi: belgeTipi,
                onceki_bakiye: 0,
                sonraki_bakiye: 0,
                cha_recno: erpHareket.cha_RECno,
                cha_kasa_hizkod: erpHareket.cha_kasa_hizkod
            });
        }

        if (rows.length === 0) return;

        const columns = [
            'erp_recno', 'cari_hesap_id', 'islem_tarihi', 'belge_no', 'tutar',
            'aciklama', 'guncelleme_tarihi', 'fatura_seri_no', 'fatura_sira_no',
            'hareket_tipi', 'hareket_turu', 'belge_tipi', 'onceki_bakiye', 'sonraki_bakiye', 'cha_recno', 'cha_kasa_hizkod'
        ];

        const updateColumns = [
            'cari_hesap_id', 'islem_tarihi', 'belge_no', 'tutar',
            'aciklama', 'guncelleme_tarihi', 'fatura_seri_no', 'fatura_sira_no',
            'hareket_tipi', 'hareket_turu', 'belge_tipi', 'onceki_bakiye', 'sonraki_bakiye', 'cha_recno', 'cha_kasa_hizkod'
        ];

        const { query, values } = this.buildBulkUpsertQuery(
            'cari_hesap_hareketleri',
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
}

module.exports = new CariHareketProcessor();
