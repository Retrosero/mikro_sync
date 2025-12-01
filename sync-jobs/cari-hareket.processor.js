const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class CariHareketProcessor {
    constructor() {
        this.tableName = 'CARI_HESAP_HAREKETLERI';
        this.BATCH_SIZE = 4000;
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
            logger.info(`Cari Hareket senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen cari hareket bulundu. Bulk işlem başlıyor...`);

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
        cha_kod, cha_meblag, cha_aratoplam,
        cha_aciklama, cha_cinsi, cha_evrak_tip, cha_tip, cha_normal_Iade as cha_normal_iade,
        cha_kasa_hizkod,
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
            const cariId = cariMap.get(erpHareket.cha_kod);
            if (!cariId) continue;

            const hareketTipi = erpHareket.cha_tip === 0 ? 'borc' : 'alacak';
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
            'hareket_tipi', 'belge_tipi', 'onceki_bakiye', 'sonraki_bakiye', 'cha_recno', 'cha_kasa_hizkod'
        ];

        const updateColumns = [
            'cari_hesap_id', 'islem_tarihi', 'belge_no', 'tutar',
            'aciklama', 'guncelleme_tarihi', 'fatura_seri_no', 'fatura_sira_no',
            'hareket_tipi', 'belge_tipi', 'onceki_bakiye', 'sonraki_bakiye', 'cha_recno', 'cha_kasa_hizkod'
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
