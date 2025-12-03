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
            const belgeTipi = 'fatura';

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
                iskonto6: erpHareket.sth_iskonto6 || 0
            });
        }

        if (rows.length === 0) return;

        const columns = [
            'erp_recno', 'stok_id', 'cari_hesap_id', 'islem_tarihi', 'belge_no',
            'miktar', 'toplam_tutar', 'kdv_orani', 'kdv_tutari', 'guncelleme_tarihi', 'fatura_seri_no',
            'fatura_sira_no', 'fat_recid_recno', 'hareket_tipi', 'belge_tipi', 'onceki_miktar', 'sonraki_miktar',
            'iskonto1', 'iskonto2', 'iskonto3', 'iskonto4', 'iskonto5', 'iskonto6'
        ];

        const updateColumns = [
            'stok_id', 'cari_hesap_id', 'islem_tarihi', 'belge_no',
            'miktar', 'toplam_tutar', 'kdv_orani', 'kdv_tutari', 'guncelleme_tarihi', 'fatura_seri_no',
            'fatura_sira_no', 'fat_recid_recno', 'hareket_tipi', 'belge_tipi', 'onceki_miktar', 'sonraki_miktar',
            'iskonto1', 'iskonto2', 'iskonto3', 'iskonto4', 'iskonto5', 'iskonto6'
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
}

module.exports = new StokHareketProcessor();
