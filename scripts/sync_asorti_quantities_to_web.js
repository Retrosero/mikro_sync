/**
 * Entegra (SQLite) -> Web (PostgreSQL) Asorti Stok Senkronizasyonu
 * 
 * Bu script:
 * 1. PostgreSQL'deki entegra_product_quantity tablosundan güncel stokları alır.
 * 2. Bu stokları stoklar tablosundaki ilgili varyantlara (ana_stok_id'li ürünlere) yazar.
 * 3. Opsiyonel: Asorti ebeveynlerinin stoklarını çocukların toplamı olarak günceller.
 */

require('dotenv').config();
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

async function syncAsortiQuantities() {
    logger.info('Asorti Stok Senkronizasyonu Başlatılıyor (Entegra -> Web)...');
    
    try {
        // 1. Varyant stoklarını güncelle
        // entegra_product_quantity -> stoklar (stok_kodu eşleşmesi ile)
        const variantUpdateSql = `
            UPDATE stoklar s
            SET eldeki_miktar = eq.quantity,
                guncelleme_tarihi = NOW()
            FROM entegra_product ep
            JOIN entegra_product_quantity eq ON ep.id = eq.product_id
            WHERE s.stok_kodu = ep."productCode"
              AND s.ana_stok_id IS NOT NULL
              AND (s.eldeki_miktar IS NULL OR s.eldeki_miktar != eq.quantity)
            RETURNING s.stok_kodu, eq.quantity;
        `;

        const updatedVariants = await pgService.query(variantUpdateSql);
        logger.info(`${updatedVariants.length} adet varyant stoğu güncellendi.`);
        
        if (updatedVariants.length > 0) {
            updatedVariants.slice(0, 5).forEach(v => {
                logger.debug(`  - ${v.stok_kodu}: ${v.quantity}`);
            });
        }

        // 2. Asorti ana stoklarını (ebeveynleri) güncelle
        // Çocukların toplamını ebeveyne yaz
        const parentUpdateSql = `
            UPDATE stoklar s
            SET eldeki_miktar = sub.total_quant,
                guncelleme_tarihi = NOW()
            FROM (
                SELECT ana_stok_id, SUM(COALESCE(eldeki_miktar, 0)) as total_quant
                FROM stoklar
                WHERE ana_stok_id IS NOT NULL
                GROUP BY ana_stok_id
            ) sub
            WHERE s.id = sub.ana_stok_id
              AND (s.eldeki_miktar IS NULL OR s.eldeki_miktar != sub.total_quant)
            RETURNING s.stok_kodu, sub.total_quant;
        `;

        const updatedParents = await pgService.query(parentUpdateSql);
        logger.info(`${updatedParents.length} adet asorti ebeveyn stoğu güncellendi.`);

        if (updatedParents.length > 0) {
            updatedParents.slice(0, 5).forEach(p => {
                logger.debug(`  - ${p.stok_kodu}: ${p.total_quant}`);
            });
        }

        // 3. asortiler tablosunu senkronize et (Eğer varsa ve kullanılıyorsa)
        // Bu tablo v_stok_asortiler view'ı tarafından kullanılıyor olabilir.
        const asortilerSyncSql = `
            INSERT INTO asortiler (id, ana_stok_id, stok_kodu, stok_adi, eldeki_miktar, aktif, olusturma_tarihi, guncelleme_tarihi)
            SELECT id, ana_stok_id, stok_kodu, stok_adi, eldeki_miktar, aktif, olusturma_tarihi, guncelleme_tarihi
            FROM stoklar
            WHERE ana_stok_id IS NOT NULL AND is_asorti = true
            ON CONFLICT (id) DO UPDATE SET
                ana_stok_id = EXCLUDED.ana_stok_id,
                stok_kodu = EXCLUDED.stok_kodu,
                stok_adi = EXCLUDED.stok_adi,
                eldeki_miktar = EXCLUDED.eldeki_miktar,
                aktif = EXCLUDED.aktif,
                guncelleme_tarihi = NOW();
        `;

        try {
            const asortilerSyncResult = await pgService.query(asortilerSyncSql);
            logger.info('asortiler tablosu güncellendi.');
        } catch (asortiErr) {
            logger.warn('asortiler tablosu güncellenirken hata (tablo mevcut olmayabilir):', asortiErr.message);
        }

        logger.info('Asorti stok senkronizasyonu tamamlandı.');
        return { 
            variantsUpdated: updatedVariants.length, 
            parentsUpdated: updatedParents.length 
        };

    } catch (error) {
        logger.error('Asorti stok senkronizasyon hatası:', error);
        throw error;
    }
}

// Script olarak çalıştırılırsa
if (require.main === module) {
    syncAsortiQuantities()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { syncAsortiQuantities };
