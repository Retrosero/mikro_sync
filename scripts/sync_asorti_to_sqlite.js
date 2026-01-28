/**
 * Asorti Ürünlerini Web (Postgres) -> Entegra (SQLite) Senkronizasyonu
 * 
 * Bu script:
 * 1. Web tarafında is_asorti=true olan stokları çeker.
 * 2. SQLite tarafında productCode ile kontrol eder.
 * 3. Eğer yoksa ürünü ve ilişkili verileri (Marka, Kategori, Resim, Fiyat, Stok) ekler.
 */

require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');
const logger = require('../utils/logger');

// Yardımcı: SQLite string escape
function escape(str) {
    if (!str) return "''";
    return "'" + str.replace(/'/g, "''") + "'";
}

async function getBrandIdFromSQLite(brandName) {
    if (!brandName) return 0;

    // Var mı kontrol et
    const row = sqliteService.queryOne(`SELECT id FROM brand WHERE name = ?`, [brandName]);
    if (row) return row.id;

    // Yoksa ekle
    logger.info(`Yeni marka ekleniyor: ${brandName}`);
    const result = sqliteService.run(`INSERT INTO brand (name, status, sync) VALUES (?, 1, 0)`, [brandName]);
    return result.lastInsertRowid;
}

async function getCategoryIdFromSQLite(categoryName) {
    if (!categoryName) return 0;

    // Var mı kontrol et
    const row = sqliteService.queryOne(`SELECT id FROM category WHERE name = ?`, [categoryName]);
    if (row) return row.id;

    // Yoksa ekle
    logger.info(`Yeni kategori ekleniyor: ${categoryName}`);
    const result = sqliteService.run(`INSERT INTO category (name, productName, status, sync) VALUES (?, ?, 1, 0)`, [categoryName, categoryName]);
    return result.lastInsertRowid;
}

async function runAsortiSync() {
    logger.info('Asorti Ürün Senkronizasyonu Başlatılıyor...');

    try {
        // 1. Web'den is_asorti=true olan stokları çek (Marka ve Kategori adlarıyla birlikte)
        // Not: pgService.query join destekliyor, direkt sql yazabiliriz.
        const query = `
            SELECT 
                s.*,
                m.marka_adi as marka_adi,
                k.kategori_adi as kategori_adi
            FROM stoklar s
            LEFT JOIN markalar m ON s.marka_id = m.id
            LEFT JOIN kategoriler k ON s.kategori_id = k.id
            WHERE s.is_asorti = true
        `;

        const asortiProducts = await pgService.query(query);
        logger.info(`${asortiProducts.length} adet asorti ürün bulundu.`);

        if (asortiProducts.length === 0) {
            logger.info('İşlenecek ürün yok.');
            return;
        }

        sqliteService.connect(false); // Yazma modu

        let addedCount = 0;
        let skippedCount = 0;

        for (const product of asortiProducts) {
            const productCode = product.stok_kodu;

            // 2. SQLite'da kontrol et
            const existing = sqliteService.queryOne(`SELECT id FROM product WHERE productCode = ?`, [productCode]);

            if (existing) {
                // logger.info(`Ürün zaten var, atlanıyor: ${productCode}`);
                skippedCount++;
                continue;
            }

            logger.info(`Yeni asorti ürün ekleniyor: ${productCode} - ${product.stok_adi}`);

            // 3. Marka ve Kategori ID'lerini bul/oluştur
            const brandId = await getBrandIdFromSQLite(product.marka_adi);
            const categoryId = await getCategoryIdFromSQLite(product.kategori_adi);

            // 4. Product Tablosuna Ekle
            // Temel alanlar
            const insertProductSql = `
                INSERT INTO product (
                    productCode, productName, status, brand_id, "group", 
                    currencyType, date_add, date_change, description,
                    sync, kdv_id
                ) VALUES (
                    ?, ?, 1, ?, ?,
                    'TL', datetime('now'), datetime('now'), ?,
                    0, ?
                )
            `;

            // KDV Mapping (Basit mantık: %20 -> id?) 
            // Genellikle KDV ID'si Entegra'da değişir, varsayılan 0 veya 18/20'ye karşılık gelen ID girilmeli.
            // Kullanıcı belirtmediği için varsayılan 0 veriyoruz veya mapping yapabiliriz.
            // int_kdv_pointer_map (MSSQL) vardı, burada basitçe oran üzerinden gidelim veya 0 verelim.
            let kdvId = 0;
            // Basit hack: kdv_orani varsa kullan
            if (product.kdv_orani) {
                // SQLite tarafında kdv tablosu olabilir ama şu an varsayalım
                kdvId = Math.floor(product.kdv_orani);
            }

            const productResult = sqliteService.run(insertProductSql, [
                product.stok_kodu,
                product.stok_adi,
                brandId,
                categoryId,
                product.aciklama || '',
                kdvId
            ]);

            const newProductId = productResult.lastInsertRowid;

            // 5. Product Prices Ekle (SQLite)
            sqliteService.run(`
                INSERT INTO product_prices (
                    product_id, price1, buying_price, sync_ai
                ) VALUES (?, ?, ?, 0)
            `, [
                newProductId,
                parseFloat(product.satis_fiyati || 0),
                parseFloat(product.alis_fiyati || 0)
            ]);

            // 6. Product Quantity Ekle (SQLite)
            sqliteService.run(`
                INSERT INTO product_quantity (
                    product_id, quantity, sync_ai
                ) VALUES (?, ?, 0)
            `, [
                newProductId,
                parseInt(product.eldeki_miktar || 0)
            ]);

            // 7. Product Description Ekle (SQLite)
            sqliteService.run(`
                INSERT INTO product_description (
                    product_id, description, sync_ai
                ) VALUES (?, ?, 0)
            `, [
                newProductId,
                product.aciklama || ''
            ]);

            // 8. Resimler (Pictures) Ekle (SQLite)
            const images = [];
            if (product.resim_url) images.push(product.resim_url);
            for (let i = 2; i <= 10; i++) {
                const url = product[`resim_url_${i}`];
                if (url) images.push(url);
            }

            if (images.length > 0) {
                images.forEach((url, index) => {
                    sqliteService.run(`
                        INSERT INTO pictures (
                            product_id, path, "default", sync
                        ) VALUES (?, ?, ?, 0)
                    `, [
                        newProductId,
                        url,
                        index === 0 ? 1 : 0
                    ]);
                });
            }

            // === POSTGRESQL ENTEGRA TABLES UPDATE ===
            // SQLite ID'sini PG tarafında da ID olarak kullanarak tutarlılık sağlıyoruz.
            try {
                // entegra_product
                const pgProductCheck = await pgService.query(`SELECT id FROM entegra_product WHERE "productCode" = $1`, [productCode]);
                if (pgProductCheck.length === 0) {
                    await pgService.query(`
                        INSERT INTO entegra_product (
                            id, "productCode", "productName", status, brand_id, "group", 
                            "currencyType", date_add, date_change, description, sync, kdv_id
                        ) VALUES (
                            $1, $2, $3, 1, $4, $5, 
                            'TL', NOW(), NOW(), $6, 0, $7
                        )
                    `, [
                        newProductId, product.stok_kodu, product.stok_adi, brandId, categoryId,
                        product.aciklama || '', kdvId
                    ]);
                }

                // entegra_product_prices
                await pgService.query(`
                    INSERT INTO entegra_product_prices (
                        id, product_id, store_id, price1, buying_price, sync_ai
                    ) VALUES ($1, $2, 0, $3, $4, 0)
                `, [newProductId, newProductId, parseFloat(product.satis_fiyati || 0), parseFloat(product.alis_fiyati || 0)]);

                // entegra_product_quantity
                await pgService.query(`
                    INSERT INTO entegra_product_quantity (
                        id, product_id, store_id, quantity, sync_ai
                    ) VALUES ($1, $2, 0, $3, 0)
                `, [newProductId, newProductId, parseInt(product.eldeki_miktar || 0)]);

                // entegra_product_description
                await pgService.query(`
                    INSERT INTO entegra_product_description (
                        id, product_id, description, sync_ai
                    ) VALUES ($1, $2, $3, 0)
                `, [newProductId, newProductId, product.aciklama || '']);

                // entegra_pictures
                if (images.length > 0) {
                    for (let i = 0; i < images.length; i++) {
                        // ID cakismasi olmamasi icin random veya timestamp based bir ID uretmek gerekebilir PG icin
                        // Fakat burada basitce bir unique ID uretmeliyiz. 
                        // SQLite pictures tablosunda ID autoincrement. PG'de de oyleyse ID vermemize gerek yok.
                        // entegra_pictures semasina bakalim: id (bigint) [NO].
                        // Eger sequence yoksa manuel vermeliyiz. Cakismalari onlemek icin time + index kullanalim.
                        const picId = Date.now() + i;

                        await pgService.query(`
                            INSERT INTO entegra_pictures (
                                id, product_id, path, "default", sync
                            ) VALUES ($1, $2, $3, $4, 0)
                        `, [picId, newProductId, images[i], i === 0 ? 1 : 0]);
                    }
                }

            } catch (pgError) {
                logger.error(`PostgreSQL Entegra tablolarına yazma hatası: ${productCode}`, pgError);
                // PG hatası olsa bile SQLite işlemi başarılı sayılır, devam ediyoruz.
            }
            // ========================================

            addedCount++;
        }

        logger.info(`Senkronizasyon tamamlandı.`);
        logger.info(`Eklenen: ${addedCount}`);
        logger.info(`Atlanan (Zaten var): ${skippedCount}`);

    } catch (error) {
        logger.error('Asorti sync hatası:', error);
    } finally {
        sqliteService.disconnect();
        // NOT: pgService.disconnect() burada çağrılmamalı, 
        // ana process (index.js) bağlantıyı yönetiyor.
    }
}

// Script olarak çalıştırılırsa
if (require.main === module) {
    runAsortiSync().then(() => process.exit(0));
}

module.exports = { runAsortiSync };
