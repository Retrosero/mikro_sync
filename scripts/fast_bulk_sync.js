// fast_bulk_sync.js
// High‑performance bulk synchronization for large tables (e.g., 30k+ rows)
// Uses PostgreSQL "INSERT ... ON CONFLICT" for upserts and batches of 500 rows.

const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const stokTransformer = require('../transformers/stok.transformer');
const fiyatTransformer = require('../transformers/stok.transformer'); // reuse transformer for price
const logger = require('../utils/logger');
const syncStateService = require('../services/sync-state.service');

// Configurable batch size – adjust for memory / performance trade‑off
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 500;

async function bulkSyncStocks() {
    const direction = 'erp_to_web';
    let lastSync = await syncStateService.getLastSyncTime('STOKLAR', direction);
    if (lastSync === null) {
        logger.info('İlk tam senkronizasyon – tüm stoklar aktarılıyor');
    } else {
        logger.info(`İnkremental senkronizasyon – son: ${lastSync.toISOString()}`);
    }

    const changed = await getChangedStocks(lastSync);
    logger.info(`Toplam ${changed.length} değişen stok bulundu`);

    for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;
        for (const erp of batch) {
            const web = await stokTransformer.transformFromERP(erp);
            // Prepare values for INSERT … ON CONFLICT
            values.push(
                web.stok_kodu,
                web.stok_adi,
                web.birim_turu,
                web.alis_fiyati,
                web.satis_fiyati,
                web.aciklama,
                web.olcu,
                web.raf_kodu,
                web.ambalaj,
                web.koliadeti,
                web.aktif,
                new Date()
            );
            placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        }
        const sql = `INSERT INTO stoklar (
      stok_kodu, stok_adi, birim_turu, alis_fiyati, satis_fiyati,
      aciklama, olcu, raf_kodu, ambalaj, koliadeti, aktif, guncelleme_tarihi
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (stok_kodu) DO UPDATE SET
      stok_adi = EXCLUDED.stok_adi,
      birim_turu = EXCLUDED.birim_turu,
      alis_fiyati = EXCLUDED.alis_fiyati,
      satis_fiyati = EXCLUDED.satis_fiyati,
      aciklama = EXCLUDED.aciklama,
      olcu = EXCLUDED.olcu,
      raf_kodu = EXCLUDED.raf_kodu,
      ambalaj = EXCLUDED.ambalaj,
      koliadeti = EXCLUDED.koliadeti,
      aktif = EXCLUDED.aktif,
      guncelleme_tarihi = EXCLUDED.guncelleme_tarihi`;
        await pgService.query(sql, values);
        logger.info(`Batch ${i / BATCH_SIZE + 1} işlendi – ${batch.length} kayıt`);
    }

    await syncStateService.updateSyncTime('STOKLAR', direction, changed.length, true);
    logger.info('Stok bulk senkronizasyonu tamamlandı');
}

async function getChangedStocks(lastSync) {
    let where = 'WHERE sto_pasif_fl = 0';
    const params = {};
    if (lastSync) {
        where += ' AND sto_lastup_date > @lastSync';
        params.lastSync = lastSync;
    }
    const query = `SELECT * FROM STOKLAR ${where} ORDER BY sto_lastup_date`;
    return await mssqlService.query(query, params);
}

// -------------------------------------------------------------------
// Bulk price list sync – similar batch logic
async function bulkSyncPrices() {
    const direction = 'erp_to_web_price';
    let lastSync = await syncStateService.getLastSyncTime('STOK_SATIS_FIYAT_LISTELERI', direction);
    if (lastSync === null) {
        logger.info('İlk tam fiyat senkronizasyonu – tüm fiyat listeleri aktarılıyor');
    } else {
        logger.info(`İnkremental fiyat senkronizasyonu – son: ${lastSync.toISOString()}`);
    }

    const changed = await getChangedPrices(lastSync);
    logger.info(`Toplam ${changed.length} değişen fiyat kaydı bulundu`);

    for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;
        for (const erp of batch) {
            const web = await fiyatTransformer.transformFiyatFromERP(erp);
            values.push(
                erp.sfiyat_stokkod,
                erp.sfiyat_listesirano,
                web.fiyat,
                new Date(), // olusturma_tarihi
                new Date()  // guncelleme_tarihi
            );
            placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        }
        const sql = `INSERT INTO fiyat_listeleri (
      stok_kodu, fiyat_liste_no, fiyat, olusturma_tarihi, guncelleme_tarihi
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (stok_kodu, fiyat_liste_no) DO UPDATE SET
      fiyat = EXCLUDED.fiyat,
      guncelleme_tarihi = EXCLUDED.guncelleme_tarihi`;
        await pgService.query(sql, values);
        logger.info(`Fiyat batch ${i / BATCH_SIZE + 1} işlendi – ${batch.length} kayıt`);
    }

    await syncStateService.updateSyncTime('STOK_SATIS_FIYAT_LISTELERI', direction, changed.length, true);
    logger.info('Fiyat bulk senkronizasyonu tamamlandı');
}

async function getChangedPrices(lastSync) {
    let where = 'WHERE sfiyat_fiyati > 0';
    const params = {};
    if (lastSync) {
        where += ' AND sfiyat_lastup_date > @lastSync';
        params.lastSync = lastSync;
    }
    const query = `SELECT * FROM STOK_SATIS_FIYAT_LISTELERI ${where} ORDER BY sfiyat_lastup_date`;
    return await mssqlService.query(query, params);
}

(async () => {
    try {
        await bulkSyncStocks();
        await bulkSyncPrices();
        logger.info('✅ Tüm bulk senkronizasyonları başarıyla tamamlandı');
    } catch (err) {
        logger.error('Bulk senkronizasyon hatası:', err);
        process.exit(1);
    }
})();
