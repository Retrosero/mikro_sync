const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class BankaProcessor {
    constructor() {
        this.tableName = 'BANKALAR';
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Banka senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen banka bulundu`);

            let processedCount = 0;
            let errorCount = 0;

            for (const erpBanka of changedRecords) {
                try {
                    await this.syncSingleBankaToWeb(erpBanka);
                    processedCount++;
                } catch (error) {
                    errorCount++;
                    logger.error(`Banka senkronizasyon hatası (Kod: ${erpBanka.ban_kod}):`, error.message);
                }
            }

            await syncStateService.updateSyncTime(
                this.tableName,
                direction,
                processedCount,
                errorCount === 0,
                errorCount > 0 ? `${errorCount} hata oluştu` : null
            );

            logger.info(`Banka senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Banka senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND ban_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        const query = `
            SELECT 
                ban_kod,
                ban_ismi,
                ban_sube,
                ban_hesapno,
                ban_create_date,
                ban_lastup_date
            FROM BANKALAR
            ${whereClause}
            ORDER BY ban_lastup_date
        `;

        return await mssqlService.query(query, params);
    }

    async syncSingleBankaToWeb(erpBanka) {
        const webBanka = {
            ban_kod: erpBanka.ban_kod,
            banka_adi: erpBanka.ban_ismi,
            sube_adi: erpBanka.ban_sube,
            hesap_no: erpBanka.ban_hesapno,
            olusturma_tarihi: erpBanka.ban_create_date || new Date(),
            guncelleme_tarihi: erpBanka.ban_lastup_date || new Date()
        };

        // Önce ban_kod ile ara
        let existingBanka = await pgService.queryOne('SELECT id FROM bankalar WHERE ban_kod = $1', [webBanka.ban_kod]);

        // Bulunamazsa banka_adi ile ara (Unique constraint hatası almamak için)
        if (!existingBanka) {
            existingBanka = await pgService.queryOne('SELECT id FROM bankalar WHERE banka_adi = $1', [webBanka.banka_adi]);
        }

        if (existingBanka) {
            // Var olanı güncelle (ban_kod'u da güncelle ki eşleşsin)
            await pgService.query(`
                UPDATE bankalar SET
                    ban_kod = $1,
                    banka_adi = $2,
                    sube_adi = $3,
                    hesap_no = $4,
                    olusturma_tarihi = $5,
                    guncelleme_tarihi = $6
                WHERE id = $7
            `, [webBanka.ban_kod, webBanka.banka_adi, webBanka.sube_adi, webBanka.hesap_no, webBanka.olusturma_tarihi, webBanka.guncelleme_tarihi, existingBanka.id]);
        } else {
            await pgService.query(`
                INSERT INTO bankalar (ban_kod, banka_adi, sube_adi, hesap_no, olusturma_tarihi, guncelleme_tarihi, aktif)
                VALUES ($1, $2, $3, $4, $5, $6, true)
            `, [webBanka.ban_kod, webBanka.banka_adi, webBanka.sube_adi, webBanka.hesap_no, webBanka.olusturma_tarihi, webBanka.guncelleme_tarihi]);
        }
    }
}

module.exports = new BankaProcessor();
