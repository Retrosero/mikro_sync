const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');
const syncStateService = require('../services/sync-state.service');

class EldekiMiktarProcessor {
  constructor() {
    this.tableName = 'STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW';
  }

  /**
   * ERP'den Web'e eldeki miktar senkronizasyonu
   * NOT: Bu view'de lastup_date olmadığı için her zaman TAM senkronizasyon yapılır
   * @param {Date|null} lastSyncTime - Kullanılmıyor (her zaman tam sync)
   * @param {number} batchSize - Batch boyutu (varsayılan 1000)
   * @returns {Promise<number>} İşlenen kayıt sayısı
   */
  async syncToWeb(lastSyncTime = null, batchSize = 4000) {
    try {
      const direction = 'erp_to_web';

      // NOT: View'de lastup_date olmadığı için her zaman tam senkronizasyon
      logger.info(`📦 ELDEKİ MİKTAR Bulk Sync Başlıyor (Tam - View'de lastup_date yok)...`);

      // ERP'den eldeki miktar verilerini al
      const eldekiMiktarlar = await this.getEldekiMiktarFromERP();
      logger.info(`   ${eldekiMiktarlar.length} kayıt bulundu.`);

      if (eldekiMiktarlar.length === 0) {
        await syncStateService.updateSyncTime(this.tableName, direction, 0, true);
        return 0;
      }

      // Stok mapping cache
      const stokMaps = await pgService.query('SELECT id, stok_kodu FROM stoklar');
      const stokMap = new Map(stokMaps.map(s => [s.stok_kodu, s.id]));

      let processedCount = 0;
      let skippedCount = 0;

      // Batch'ler halinde işle
      for (let i = 0; i < eldekiMiktarlar.length; i += batchSize) {
        const batch = eldekiMiktarlar.slice(i, i + batchSize);
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const erp of batch) {
          const stokId = stokMap.get(erp.stok_kodu);
          if (!stokId) {
            skippedCount++;
            continue;
          }

          const eldekiMiktar = parseFloat(erp.eldeki_miktar) || 0;
          
          values.push(stokId, eldekiMiktar, new Date());
          placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
        }

        if (values.length === 0) continue;

        // Bulk update with UPSERT
        const sql = `
          UPDATE stoklar AS s
          SET eldeki_miktar = v.eldeki_miktar::numeric,
              sth_eldeki_miktar = v.eldeki_miktar::numeric,
              guncelleme_tarihi = v.guncelleme_tarihi::timestamp
          FROM (VALUES ${placeholders.join(', ')}) AS v(id, eldeki_miktar, guncelleme_tarihi)
          WHERE s.id = v.id::uuid
            AND (s.eldeki_miktar IS NULL 
                 OR s.eldeki_miktar != v.eldeki_miktar::numeric
                 OR s.sth_eldeki_miktar IS NULL
                 OR s.sth_eldeki_miktar != v.eldeki_miktar::numeric)
        `;

        const result = await pgService.query(sql, values);
        processedCount += batch.length - skippedCount;

        process.stdout.write(`\r   🚀 ${Math.min(i + batchSize, eldekiMiktarlar.length)} / ${eldekiMiktarlar.length} eldeki miktar güncellendi...`);
      }

      console.log('');
      
      await syncStateService.updateSyncTime(
        this.tableName,
        direction,
        processedCount,
        true,
        skippedCount > 0 ? `${skippedCount} kayıt atlandı (stok bulunamadı)` : null
      );

      logger.info(`Eldeki miktar senkronizasyonu tamamlandı: ${processedCount} başarılı, ${skippedCount} atlandı`);
      return processedCount;

    } catch (error) {
      logger.error('Eldeki miktar senkronizasyon hatası:', error);
      await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
      throw error;
    }
  }

  /**
   * ERP'den eldeki miktar verilerini getirir
   * @returns {Promise<Array>} Eldeki miktar kayıtları
   */
  async getEldekiMiktarFromERP() {
    const query = `
      SELECT 
        sth_stok_kod as stok_kodu,
        sth_eldeki_miktar as eldeki_miktar
      FROM STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW
      WHERE sth_eldeki_miktar IS NOT NULL
      ORDER BY sth_stok_kod
    `;

    return await mssqlService.query(query);
  }

  /**
   * Tek bir stok için eldeki miktarı günceller
   * @param {string} stokKodu - Stok kodu
   * @param {number} eldekiMiktar - Eldeki miktar
   */
  async updateSingleStokEldekiMiktar(stokKodu, eldekiMiktar) {
    try {
      // Stok ID'sini bul
      const stok = await pgService.queryOne(
        'SELECT id FROM stoklar WHERE stok_kodu = $1',
        [stokKodu]
      );

      if (!stok) {
        logger.warn(`Stok bulunamadı: ${stokKodu}`);
        return false;
      }

      // Eldeki miktarı güncelle
      await pgService.query(
        `UPDATE stoklar 
         SET eldeki_miktar = $1,
             sth_eldeki_miktar = $1,
             guncelleme_tarihi = NOW()
         WHERE id = $2
           AND (eldeki_miktar IS NULL OR eldeki_miktar != $1 OR sth_eldeki_miktar IS NULL OR sth_eldeki_miktar != $1)`,
        [eldekiMiktar, stok.id]
      );

      logger.debug(`Eldeki miktar güncellendi: ${stokKodu} = ${eldekiMiktar}`);
      return true;

    } catch (error) {
      logger.error(`Eldeki miktar güncelleme hatası (${stokKodu}):`, error.message);
      throw error;
    }
  }
}

module.exports = new EldekiMiktarProcessor();
