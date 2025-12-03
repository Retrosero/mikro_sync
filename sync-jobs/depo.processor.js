const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class DepoProcessor {
    constructor() {
        this.tableName = 'DEPOLAR';
        this.BATCH_SIZE = 1000;
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Depo senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen depo bulundu`);

            if (changedRecords.length === 0) {
                return 0;
            }

            let processedCount = 0;
            let errorCount = 0;

            // Batch işleme
            for (let i = 0; i < changedRecords.length; i += this.BATCH_SIZE) {
                const batch = changedRecords.slice(i, i + this.BATCH_SIZE);
                try {
                    await this.processBatch(batch);
                    processedCount += batch.length;
                    logger.info(`  ${processedCount}/${changedRecords.length} depo işlendi...`);
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

            logger.info(`Depo senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Depo senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND dep_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        const query = `
      SELECT 
        dep_RECno, dep_no, dep_adi,
        dep_create_date, dep_lastup_date
      FROM DEPOLAR
      ${whereClause}
      ORDER BY dep_lastup_date
    `;

        return await mssqlService.query(query, params);
    }

    async processBatch(batch) {
        if (batch.length === 0) return;

        const rows = batch.map(erpDepo => ({
            erp_recno: erpDepo.dep_RECno,
            depo_no: erpDepo.dep_no,
            depo_adi: erpDepo.dep_adi,
            olusturma_tarihi: erpDepo.dep_create_date,
            guncelleme_tarihi: erpDepo.dep_lastup_date || new Date()
        }));

        const columns = ['erp_recno', 'depo_no', 'depo_adi', 'olusturma_tarihi', 'guncelleme_tarihi'];
        const updateColumns = ['depo_no', 'depo_adi', 'olusturma_tarihi', 'guncelleme_tarihi'];

        const { query, values } = this.buildBulkUpsertQuery(
            'depolar',
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

module.exports = new DepoProcessor();
