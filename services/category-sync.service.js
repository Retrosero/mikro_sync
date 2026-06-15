const pgService = require('./postgresql.service');
const mssqlService = require('./mssql.service');
const syncStateService = require('./sync-state.service');
const logger = require('../utils/logger');

class CategorySyncService {
  constructor() {
    this.syncStateTable = 'ERP_KATEGORILER';
    this.syncDirection = 'erp_to_web';
  }

  async syncCategories(options = {}) {
    const forceFull = Boolean(options.forceFull);
    const lastSyncTime = await syncStateService.getLastSyncTime(this.syncStateTable, this.syncDirection);
    const isFirstSync = forceFull || lastSyncTime === null;

    try {
      logger.info(
        `Kategori senkronizasyonu başlıyor (${isFirstSync ? 'TAM' : 'KONTROL'})`,
        { context: 'category-sync' }
      );

      const anaGruplar = await mssqlService.query(
        'SELECT san_kod, san_isim FROM STOK_ANA_GRUPLARI'
      );
      const altGruplar = await mssqlService.query(
        'SELECT sta_kod, sta_isim, sta_ana_grup_kod FROM STOK_ALT_GRUPLARI'
      );

      const categoryResult = await this.upsertCategories(anaGruplar, altGruplar);

      let stockCategoryUpdateCount = 0;
      if (isFirstSync) {
        stockCategoryUpdateCount = await this.syncStockCategoryAssignments();
      } else if (categoryResult.affectedErpIds.size > 0) {
        stockCategoryUpdateCount = await this.syncStockCategoryAssignments(
          Array.from(categoryResult.affectedErpIds)
        );
      }

      const totalProcessed =
        categoryResult.insertedCount +
        categoryResult.updatedCount +
        stockCategoryUpdateCount;

      await syncStateService.updateSyncTime(
        this.syncStateTable,
        this.syncDirection,
        totalProcessed,
        true,
        null
      );

      logger.info(
        `Kategori senkronizasyonu tamamlandı: ${categoryResult.insertedCount} yeni, ${categoryResult.updatedCount} güncel kategori, ${stockCategoryUpdateCount} stok kategori bağı güncellendi.`,
        { context: 'category-sync' }
      );

      return {
        ...categoryResult,
        stockCategoryUpdateCount,
        totalProcessed
      };
    } catch (error) {
      logger.error('Kategori senkronizasyon hatası:', {
        context: 'category-sync',
        error: error.message
      });
      await syncStateService.updateSyncTime(
        this.syncStateTable,
        this.syncDirection,
        0,
        false,
        error.message
      );
      throw error;
    }
  }

  async ensureCategorySchema(client) {
    await client.query(`
      ALTER TABLE kategoriler
      ADD COLUMN IF NOT EXISTS is_erp_category boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS erp_id text;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_kategoriler_erp_id
      ON kategoriler(erp_id);
    `);
  }

  normalizeText(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  async upsertCategories(anaGruplar, altGruplar) {
    return pgService.transaction(async (client) => {
      await this.ensureCategorySchema(client);

      const existingRows = await client.query(`
        SELECT id, erp_id, kategori_adi, parent_id, level, is_erp_category
        FROM kategoriler
        WHERE erp_id IS NOT NULL
      `);

      const existingMap = new Map();
      for (const row of existingRows.rows) {
        existingMap.set(this.normalizeText(row.erp_id), row);
      }

      const affectedErpIds = new Set();
      let insertedCount = 0;
      let updatedCount = 0;

      const anaGrupMap = new Map();

      for (const anaGrup of anaGruplar) {
        const erpId = this.normalizeText(anaGrup.san_kod);
        const name = this.normalizeText(anaGrup.san_isim);
        const existing = existingMap.get(erpId);

        let categoryId;
        if (existing) {
          categoryId = existing.id;
          const needsUpdate =
            this.normalizeText(existing.kategori_adi) !== name ||
            existing.level !== 0 ||
            existing.parent_id !== null ||
            existing.is_erp_category !== true;

          if (needsUpdate) {
            await client.query(
              `
                UPDATE kategoriler
                SET kategori_adi = $1,
                    parent_id = NULL,
                    level = 0,
                    is_erp_category = true,
                    path = ARRAY[$2::text],
                    guncelleme_tarihi = NOW()
                WHERE id = $2::uuid
              `,
              [name, categoryId]
            );
            updatedCount++;
            affectedErpIds.add(erpId);
          }
        } else {
          const insertResult = await client.query(
            `
              INSERT INTO kategoriler (kategori_adi, is_erp_category, erp_id, level, parent_id, path)
              VALUES ($1, true, $2::text, 0, NULL, ARRAY[]::text[])
              RETURNING id
            `,
            [name, erpId]
          );

          categoryId = insertResult.rows[0].id;
          await client.query(
            'UPDATE kategoriler SET path = ARRAY[$1::text] WHERE id = $1::uuid',
            [categoryId]
          );

          insertedCount++;
          affectedErpIds.add(erpId);
        }

        anaGrupMap.set(erpId, categoryId);
      }

      for (const altGrup of altGruplar) {
        const erpId = this.normalizeText(altGrup.sta_kod);
        const name = this.normalizeText(altGrup.sta_isim);
        const parentErpId = this.normalizeText(altGrup.sta_ana_grup_kod);
        const parentId = anaGrupMap.get(parentErpId);

        if (!parentId) {
          logger.warn(
            `Alt grup atlandı: ${erpId} için ana grup bulunamadı (${parentErpId})`,
            { context: 'category-sync' }
          );
          continue;
        }

        const existing = existingMap.get(erpId);
        if (existing) {
          const needsUpdate =
            this.normalizeText(existing.kategori_adi) !== name ||
            existing.level !== 1 ||
            existing.parent_id !== parentId ||
            existing.is_erp_category !== true;

          if (needsUpdate) {
            await client.query(
              `
                UPDATE kategoriler
                SET kategori_adi = $1,
                    parent_id = $2::uuid,
                    level = 1,
                    is_erp_category = true,
                    path = ARRAY[$2::text, $3::text],
                    guncelleme_tarihi = NOW()
                WHERE id = $3::uuid
              `,
              [name, parentId, existing.id]
            );
            updatedCount++;
            affectedErpIds.add(erpId);
            affectedErpIds.add(parentErpId);
          }
        } else {
          const insertResult = await client.query(
            `
              INSERT INTO kategoriler (kategori_adi, is_erp_category, erp_id, level, parent_id, path)
              VALUES ($1, true, $2::text, 1, $3::uuid, ARRAY[]::text[])
              RETURNING id
            `,
            [name, erpId, parentId]
          );

          const categoryId = insertResult.rows[0].id;
          await client.query(
            'UPDATE kategoriler SET path = ARRAY[$1::text, $2::text] WHERE id = $2::uuid',
            [parentId, categoryId]
          );

          insertedCount++;
          affectedErpIds.add(erpId);
          affectedErpIds.add(parentErpId);
        }
      }

      return {
        insertedCount,
        updatedCount,
        affectedErpIds
      };
    });
  }

  buildMssqlInClause(values) {
    const params = {};
    const placeholders = values.map((value, index) => {
      const key = `p${index}`;
      params[key] = value;
      return `@${key}`;
    });

    return {
      clause: placeholders.join(', '),
      params
    };
  }

  async syncStockCategoryAssignments(affectedErpIds = null) {
    const categoryRows = await pgService.query(
      'SELECT id, erp_id FROM kategoriler WHERE erp_id IS NOT NULL'
    );
    const categoryMap = new Map();
    for (const row of categoryRows) {
      const erpId = this.normalizeText(row.erp_id);
      if (erpId) {
        categoryMap.set(erpId, row.id);
      }
    }

    let stockQuery = `
      SELECT sto_kod, sto_altgrup_kod, sto_anagrup_kod
      FROM STOKLAR
      WHERE sto_pasif_fl = 0
    `;
    let stockParams = {};

    if (Array.isArray(affectedErpIds) && affectedErpIds.length > 0) {
      const { clause, params } = this.buildMssqlInClause(affectedErpIds);
      stockQuery += `
        AND (
          sto_altgrup_kod IN (${clause})
          OR sto_anagrup_kod IN (${clause})
        )
      `;
      stockParams = params;
    }

    const erpStocks = await mssqlService.query(stockQuery, stockParams);
    if (erpStocks.length === 0) {
      return 0;
    }

    const stokKodlari = erpStocks.map((stock) => this.normalizeText(stock.sto_kod)).filter(Boolean);
    const webStocks = await pgService.query(
      'SELECT id, stok_kodu, kategori_id FROM stoklar WHERE stok_kodu = ANY($1)',
      [stokKodlari]
    );

    const webStockMap = new Map();
    for (const stock of webStocks) {
      webStockMap.set(this.normalizeText(stock.stok_kodu), stock);
    }

    const updates = [];
    for (const erpStock of erpStocks) {
      const stokKodu = this.normalizeText(erpStock.sto_kod);
      const webStock = webStockMap.get(stokKodu);
      if (!webStock) {
        continue;
      }

      const altGrupKod = this.normalizeText(erpStock.sto_altgrup_kod);
      const anaGrupKod = this.normalizeText(erpStock.sto_anagrup_kod);

      const desiredCategoryId =
        (altGrupKod && categoryMap.get(altGrupKod)) ||
        (anaGrupKod && categoryMap.get(anaGrupKod)) ||
        null;

      const currentCategoryId = webStock.kategori_id || null;
      if (currentCategoryId !== desiredCategoryId) {
        updates.push({
          id: webStock.id,
          kategori_id: desiredCategoryId
        });
      }
    }

    if (updates.length === 0) {
      return 0;
    }

    const values = [];
    const tuples = [];
    let paramIndex = 1;

    for (const update of updates) {
      tuples.push(`($${paramIndex++}, $${paramIndex++})`);
      values.push(update.id, update.kategori_id);
    }

    await pgService.query(
      `
        UPDATE stoklar AS s
        SET kategori_id = v.kategori_id::uuid,
            guncelleme_tarihi = NOW()
        FROM (VALUES ${tuples.join(', ')}) AS v(id, kategori_id)
        WHERE s.id = v.id::uuid
      `,
      values
    );

    logger.info(
      `${updates.length} stok kaydının kategori bağı güncellendi.`,
      { context: 'category-sync' }
    );

    return updates.length;
  }
}

module.exports = new CategorySyncService();
