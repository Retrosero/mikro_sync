require('dotenv').config();
const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');
const satisProcessor = require('../sync-jobs/satis.processor');
const tahsilatProcessor = require('../sync-jobs/tahsilat.processor');
const logger = require('../utils/logger');

class SyncQueueWorker {
    constructor() {
        this.isRunning = false;
        this.pollInterval = 5000; // 5 saniye
        this.maxRetries = 3;
    }

    async start() {
        if (this.isRunning) {
            logger.warn('Sync queue worker zaten çalışıyor');
            return;
        }

        this.isRunning = true;
        logger.info('Sync queue worker başlatıldı');

        // İlk çalıştırma
        await this.processQueue();

        // Periyodik çalıştırma
        this.intervalId = setInterval(async () => {
            await this.processQueue();
        }, this.pollInterval);
    }

    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('Sync queue worker durduruldu');
    }

    async processQueue() {
        try {
            // Bekleyen kayıtları al (en eski önce)
            const pendingItems = await pgService.query(`
        SELECT id, entity_type, entity_id, operation, retry_count, record_data
        FROM sync_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 10
      `);

            if (pendingItems.length === 0) {
                return;
            }

            logger.info(`${pendingItems.length} bekleyen sync kaydı işleniyor...`);

            for (const item of pendingItems) {
                await this.processItem(item);
            }

        } catch (error) {
            logger.error('Queue işleme hatası:', error);
        }
    }

    async processItem(item) {
        // ERP senkronizasyonu gerekmeyen entity tipleri
        // Bu tablolar sadece web tarafında kullanılır, ERP'ye yazılmaz
        const IGNORED_ENTITY_TYPES = [
            // 'entegra_product_manual' ve 'entegra_product' kaldırıldı - SQLite'a yazılıyor
            'entegra_order',
            'entegra_order_status',
            'entegra_order_product',
            'entegra_pictures',
            'entegra_product_quantity',
            'entegra_product_prices',
            'entegra_product_info',
            'entegra_messages',
            'entegra_message_template',
            'entegra_customer',
            'entegra_brand',
            'entegra_category',
            'entegra_category2',
            'entegra_product_description'
        ];

        try {
            // Ignore edilecek entity tiplerini kontrol et
            if (IGNORED_ENTITY_TYPES.includes(item.entity_type)) {
                logger.info(`⏭ ${item.entity_type} ERP senkronizasyonu gerekmiyor, atlanıyor: ${item.entity_id}`);
                await pgService.query(
                    `UPDATE sync_queue 
                     SET status = 'completed', 
                         processed_at = NOW(),
                         error_message = 'ERP senkronizasyonu gerekmiyor'
                     WHERE id = $1`,
                    [item.id]
                );
                return;
            }

            // Durumu processing yap
            await pgService.query(
                `UPDATE sync_queue SET status = 'processing' WHERE id = $1`,
                [item.id]
            );

            // Entity verisini çek
            let entityData = null;

            if (item.entity_type === 'satis' || item.entity_type === 'satislar') {
                // Satış verilerini çek (satış kalemleri ile birlikte)
                const satis = await pgService.query(
                    `SELECT * FROM satislar WHERE id = $1`,
                    [item.entity_id]
                );

                if (satis.length === 0) {
                    const id = item.record_data?.fatura_no || item.entity_id;
                    throw new Error(`Satış bulunamadı: ${id}`);
                }

                entityData = satis[0];

                // Processor'a gönder
                await satisProcessor.syncToERP(entityData);

            } else if (item.entity_type === 'tahsilat') {
                // Tahsilat verilerini çek
                const tahsilat = await pgService.query(
                    `SELECT * FROM tahsilatlar WHERE id = $1`,
                    [item.entity_id]
                );

                if (tahsilat.length === 0) {
                    const id = item.record_data?.tahsilat_no || item.entity_id;
                    throw new Error(`Tahsilat bulunamadı: ${id}`);
                }

                entityData = tahsilat[0];

                // Processor'a gönder
                await tahsilatProcessor.syncToERP(entityData);

            } else if (item.entity_type === 'alis' || item.entity_type === 'alislar') {
                // Alış verilerini çek
                const alis = await pgService.query(
                    `SELECT * FROM alislar WHERE id = $1`,
                    [item.entity_id]
                );

                if (alis.length === 0) {
                    const id = item.record_data?.fatura_no || item.record_data?.belge_no || item.entity_id;
                    throw new Error(`Alış bulunamadı: ${id}`);
                }

                entityData = alis[0];

                // Processor'a gönder
                const alisProcessor = require('../sync-jobs/alis.processor');
                await alisProcessor.syncToERP(entityData);

            } else if (item.entity_type === 'iade') {
                // İade verilerini çek
                const iade = await pgService.query(
                    `SELECT * FROM iadeler WHERE id = $1`,
                    [item.entity_id]
                );

                if (iade.length === 0) {
                    const id = item.record_data?.fatura_no || item.entity_id;
                    throw new Error(`İade bulunamadı: ${id}`);
                }

                entityData = iade[0];

                // Processor'a gönder
                const iadeProcessor = require('../sync-jobs/iade.processor');
                await iadeProcessor.syncToERP(entityData);

            } else if (item.entity_type === 'stok_hareket' || item.entity_type === 'stok_hareketleri') {
                // Stok Hareket verilerini çek
                const stokHareket = await pgService.query(
                    `SELECT * FROM stok_hareketleri WHERE id = $1`,
                    [item.entity_id]
                );

                if (stokHareket.length === 0) {
                    const id = item.record_data?.belge_no || item.entity_id;
                    throw new Error(`Stok Hareketi bulunamadı: ${id}`);
                }

                entityData = stokHareket[0];

                // Processor'a gönder
                const stokHareketProcessor = require('../sync-jobs/stok-hareket.processor');
                await stokHareketProcessor.syncToERP(entityData);

            } else if (item.entity_type === 'stoklar' || item.entity_type === 'stok') {
                // Stok verilerini çek
                const stok = await pgService.query(
                    `SELECT * FROM stoklar WHERE id = $1`,
                    [item.entity_id]
                );

                if (stok.length === 0) {
                    const id = item.record_data?.stok_kodu || item.entity_id;
                    throw new Error(`Stok bulunamadı: ${id}`);
                }

                entityData = stok[0];

                // Processor'a gönder
                const stokProcessor = require('../sync-jobs/stok.processor');
                await stokProcessor.syncToERP(entityData);

            } else if (item.entity_type === 'urun_barkodlari' || item.entity_type === 'barkod') {
                // Barkod verilerini çek
                const barkod = await pgService.query(
                    `SELECT * FROM urun_barkodlari WHERE id = $1`,
                    [item.entity_id]
                );

                if (barkod.length === 0) {
                    const id = item.record_data?.barkod || item.entity_id;
                    throw new Error(`Barkod bulunamadı: ${id}`);
                }

                entityData = barkod[0];

                // DELETE işlemi için özel kontrol
                if (item.operation === 'DELETE') {
                    const barkodProcessor = require('../sync-jobs/barkod.processor');
                    await barkodProcessor.deleteFromERP(entityData.barkod);
                } else {
                    // INSERT veya UPDATE işlemi
                    const barkodProcessor = require('../sync-jobs/barkod.processor');
                    await barkodProcessor.syncToERP(entityData);
                }

            } else if (item.entity_type === 'cari' || item.entity_type === 'cari_hesaplar') {
                // Cari verilerini çek
                const cari = await pgService.query(
                    `SELECT * FROM cari_hesaplar WHERE id = $1`,
                    [item.entity_id]
                );

                if (cari.length === 0) {
                    throw new Error(`Cari bulunamadı: ${item.entity_id}`);
                }

                entityData = cari[0];

                // Processor'a gönder
                const cariProcessor = require('../sync-jobs/cari.processor');
                await cariProcessor.syncToERP(entityData);

            } else if (item.entity_type === 'cari_hesap_hareketleri') {
                // Cari hesap hareketleri verilerini çek
                const cariHareket = await pgService.query(
                    `SELECT * FROM cari_hesap_hareketleri WHERE id = $1`,
                    [item.entity_id]
                );

                if (cariHareket.length === 0) {
                    throw new Error(`Cari Hareket bulunamadı: ${item.entity_id}`);
                }

                entityData = cariHareket[0];

                // Processor'a gönder - tahsilat processor'ı kullanabiliriz veya yeni processor
                // Şimdilik skip ediyoruz - sadece completed olarak işaretliyoruz
                logger.info(`cari_hesap_hareketleri senkronizasyonu atlandı (ERP'ye yazma henüz uygulanmadı): ${item.entity_id}`);

            } else if (item.entity_type === 'entegra_product') {
                // Web'den ürün güncelleme - SQLite'daki product tablosuna yaz
                const queueRecord = await pgService.query(
                    `SELECT record_data FROM sync_queue WHERE id = $1`,
                    [item.id]
                );

                if (queueRecord.length === 0 || !queueRecord[0].record_data) {
                    throw new Error(`entegra_product için record_data bulunamadı: ${item.id}`);
                }

                const recordData = queueRecord[0].record_data;
                const productId = parseInt(recordData.product_id);
                const changes = recordData.changes || {};

                if (!productId) {
                    throw new Error(`entegra_product için geçersiz product_id: ${recordData.product_id}`);
                }

                if (Object.keys(changes).length === 0) {
                    logger.info(`⏭ entegra_product değişiklik yok, atlanıyor: ProductID=${productId}`);
                    entityData = recordData;
                } else {
                    // SQLite bağlantısını aç (yazma modu) - retry mekanizması ile
                    let retryCount = 0;
                    const maxRetries = 5;
                    let success = false;

                    while (!success && retryCount < maxRetries) {
                        try {
                            sqliteService.connect(false);

                            try {
                                // Product kaydını kontrol et
                                const existingProduct = sqliteService.queryOne(
                                    `SELECT id FROM product WHERE id = ?`,
                                    [productId]
                                );

                                if (existingProduct) {
                                    // Alanları ayır: quantity -> product_quantity, description -> product_description, 
                                    // fiyat alanları -> product_prices, brand -> atla (SQLite'da brand_id var), diğerleri -> product
                                    const productFields = [];
                                    const productValues = [];
                                    const priceFields = [];
                                    const priceValues = [];
                                    let quantityValue = null;
                                    let descriptionValue = null;
                                    let brandName = null; // Marka adı (brand tablosunda aranacak)

                                    // Fiyat alanlarını tanımla (product_prices tablosundaki kolonlar)
                                    const priceFieldNames = [
                                        'price1', 'price2', 'price3', 'price4', 'price5', 'price6', 'price7', 'price8',
                                        'n11_price', 'n11_discountValue', 'gg_marketPrice', 'gg_buyNowPrice', 'hb_price',
                                        'trendyol_listPrice', 'trendyol_salePrice', 'eptt_price', 'eptt_iskonto',
                                        'n11pro_price', 'n11pro_discountValue', 'amazon_price', 'amazon_salePrice',
                                        'mizu_price1', 'mizu_price2', 'zebramo_listPrice', 'zebramo_salePrice',
                                        'farmazon_price', 'farmazon_market_price', 'farmaBorsaPrice', 'farmaborsa_psPrice',
                                        'morhipo_listPrice', 'morhipo_salePrice', 'lidyana_listPrice', 'lidyana_salePrice',
                                        'pazarama_listPrice', 'pazarama_salePrice', 'vfmall_listPrice', 'vfmall_salePrice',
                                        'aliniyor_listPrice', 'aliniyor_salePrice', 'aliexpress_price', 'aliexpress_salePrice',
                                        'modanisa_listPrice', 'modanisa_salePrice', 'bpazar_price1', 'bpazar_price2',
                                        'flo_listPrice', 'flo_salePrice', 'novadan_price', 'needion_listPrice', 'needion_salePrice',
                                        'bisifirat_listPrice', 'bisifirat_salePrice', 'iyifiyat_listPrice', 'iyifiyat_salePrice',
                                        'buying_price'
                                    ];

                                    Object.keys(changes).forEach(fieldName => {
                                        // prices özel durumu (iç içe obje olabilir)
                                        if (fieldName === 'prices' && typeof changes[fieldName] === 'object' && !changes[fieldName].hasOwnProperty('new')) {
                                            const priceChanges = changes[fieldName];
                                            Object.keys(priceChanges).forEach(pf => {
                                                const val = priceChanges[pf].new;
                                                if (priceFieldNames.includes(pf)) {
                                                    priceFields.push(`${pf} = ?`);
                                                    priceValues.push(parseFloat(val) || 0);
                                                }
                                            });
                                            return;
                                        }

                                        const newValue = changes[fieldName].new;

                                        if (fieldName === 'quantity') {
                                            // quantity alanı product_quantity tablosuna yazılacak
                                            quantityValue = parseFloat(newValue) || 0;
                                        } else if (fieldName === 'description') {
                                            // description alanı product_description tablosuna yazılacak
                                            descriptionValue = newValue;
                                        } else if (priceFieldNames.includes(fieldName)) {
                                            // Fiyat alanları product_prices tablosuna yazılacak
                                            priceFields.push(`${fieldName} = ?`);
                                            priceValues.push(parseFloat(newValue) || 0);
                                        } else if (fieldName === 'brand') {
                                            // brand alanı (marka adı) - brand tablosunda aranacak
                                            brandName = newValue;
                                        } else {
                                            // Diğer alanlar product tablosuna
                                            productFields.push(`${fieldName} = ?`);
                                            productValues.push(newValue);
                                        }
                                    });

                                    // Marka değeri varsa işle (ID veya isim olabilir)
                                    if (brandName !== null && brandName !== '') {
                                        const brandValue = String(brandName).trim();

                                        // Sayı mı kontrol et (marka ID'si)
                                        const isNumeric = /^\d+$/.test(brandValue);

                                        if (isNumeric) {
                                            // Sayı ise doğrudan brand_id olarak kullan
                                            const brandId = parseInt(brandValue);
                                            productFields.push(`brand_id = ?`);
                                            productValues.push(brandId);
                                            logger.info(`✓ Marka ID kullanıldı: ${brandId}`);
                                        } else {
                                            // Metin ise brand tablosunda ara
                                            const brandRecord = sqliteService.queryOne(
                                                `SELECT id FROM brand WHERE name = ? COLLATE NOCASE`,
                                                [brandValue]
                                            );

                                            if (brandRecord) {
                                                productFields.push(`brand_id = ?`);
                                                productValues.push(brandRecord.id);
                                                logger.info(`✓ Marka bulundu: "${brandValue}" (ID: ${brandRecord.id})`);
                                            } else {
                                                logger.warn(`⚠ Marka bulunamadı: "${brandValue}" - brand_id güncellenemedi`);
                                            }
                                        }
                                    }

                                    // 1. product tablosunu güncelle (quantity hariç)
                                    if (productFields.length > 0) {
                                        productValues.push(productId);
                                        const productQuery = `UPDATE product SET ${productFields.join(', ')} WHERE id = ?`;
                                        sqliteService.run(productQuery, productValues);
                                        logger.info(`✓ SQLite product güncellendi: ProductID=${productId}, Alanlar: ${productFields.map(f => f.split(' = ')[0]).join(', ')}`);
                                    }

                                    // 2. quantity varsa product_quantity tablosunu güncelle
                                    if (quantityValue !== null) {
                                        const quantityRecord = sqliteService.queryOne(
                                            `SELECT id FROM product_quantity WHERE product_id = ?`,
                                            [productId]
                                        );

                                        if (quantityRecord) {
                                            sqliteService.run(
                                                `UPDATE product_quantity SET quantity = ? WHERE product_id = ?`,
                                                [quantityValue, productId]
                                            );
                                            logger.info(`✓ SQLite product_quantity güncellendi: ProductID=${productId}, quantity=${quantityValue}`);
                                        } else {
                                            // Kayıt yoksa ekle
                                            sqliteService.run(
                                                `INSERT INTO product_quantity (product_id, product_option_value_id, store_id, supplier, quantity, quantity2, sync_ai) 
                                                 VALUES (?, 0, 0, 'Web Sync', ?, 0, 0)`,
                                                [productId, quantityValue]
                                            );
                                            logger.info(`✓ SQLite product_quantity eklendi: ProductID=${productId}, quantity=${quantityValue}`);
                                        }
                                    }

                                    // 3. description varsa product_description tablosunu güncelle
                                    if (descriptionValue !== null) {
                                        const descRecord = sqliteService.queryOne(
                                            `SELECT id FROM product_description WHERE product_id = ?`,
                                            [productId]
                                        );

                                        if (descRecord) {
                                            sqliteService.run(
                                                `UPDATE product_description SET description = ? WHERE product_id = ?`,
                                                [descriptionValue, productId]
                                            );
                                            logger.info(`✓ SQLite product_description güncellendi: ProductID=${productId}`);
                                        } else {
                                            // Kayıt yoksa ekle
                                            sqliteService.run(
                                                `INSERT INTO product_description (product_id, description, eanshare_description, sync_ai) 
                                                 VALUES (?, ?, '', 0)`,
                                                [productId, descriptionValue]
                                            );
                                            logger.info(`✓ SQLite product_description eklendi: ProductID=${productId}`);
                                        }
                                    }

                                    // 4. Fiyat alanları varsa product_prices tablosunu güncelle
                                    if (priceFields.length > 0) {
                                        const priceRecord = sqliteService.queryOne(
                                            `SELECT id FROM product_prices WHERE product_id = ?`,
                                            [productId]
                                        );

                                        if (priceRecord) {
                                            priceValues.push(productId);
                                            const priceQuery = `UPDATE product_prices SET ${priceFields.join(', ')} WHERE product_id = ?`;
                                            sqliteService.run(priceQuery, priceValues);
                                            logger.info(`✓ SQLite product_prices güncellendi: ProductID=${productId}, Alanlar: ${priceFields.map(f => f.split(' = ')[0]).join(', ')}`);
                                        } else {
                                            // Kayıt yoksa ekle (temel alanlarla)
                                            const insertFields = ['product_id', 'product_option_value_id', 'store_id', 'supplier', ...priceFields.map(f => f.split(' = ')[0])];
                                            const insertValues = [productId, 0, 0, 'Web Sync', ...priceValues];
                                            const placeholders = insertFields.map(() => '?').join(', ');

                                            sqliteService.run(
                                                `INSERT INTO product_prices (${insertFields.join(', ')}) VALUES (${placeholders})`,
                                                insertValues
                                            );
                                            logger.info(`✓ SQLite product_prices eklendi: ProductID=${productId}`);
                                        }
                                    }
                                } else {
                                    logger.warn(`⚠ SQLite product tablosunda ürün bulunamadı: ProductID=${productId}`);
                                }
                            } finally {
                                sqliteService.disconnect();
                            }

                            success = true;
                        } catch (error) {
                            if (error.message && error.message.includes('database is locked')) {
                                retryCount++;
                                if (retryCount < maxRetries) {
                                    const waitTime = retryCount * 500; // 500ms, 1000ms, 1500ms...
                                    logger.warn(`⚠ SQLite kilitli, ${waitTime}ms sonra tekrar denenecek (${retryCount}/${maxRetries})`);
                                    await new Promise(resolve => setTimeout(resolve, waitTime));
                                } else {
                                    throw new Error(`SQLite veritabanı ${maxRetries} denemeden sonra hala kilitli: ${error.message}`);
                                }
                            } else {
                                throw error;
                            }
                        }
                    }

                    entityData = recordData;
                }

            } else if (item.entity_type === 'entegra_product_manual') {
                // Web'den manuel stok güncelleme - SQLite'daki product_quantity tablosuna yaz
                // sync_queue kaydından record_data'yı al
                const queueRecord = await pgService.query(
                    `SELECT record_data FROM sync_queue WHERE id = $1`,
                    [item.id]
                );

                if (queueRecord.length === 0 || !queueRecord[0].record_data) {
                    throw new Error(`entegra_product_manual için record_data bulunamadı: ${item.id}`);
                }

                const recordData = queueRecord[0].record_data;
                const productId = parseInt(recordData.product_id);
                const quantity = parseFloat(recordData.quantity) || 0;

                if (!productId) {
                    throw new Error(`entegra_product_manual için geçersiz product_id: ${recordData.product_id}`);
                }

                // SQLite bağlantısını aç (yazma modu)
                sqliteService.connect(false);

                try {
                    // product_quantity tablosunda bu product_id var mı kontrol et
                    const existingRecord = sqliteService.queryOne(
                        `SELECT id, quantity FROM product_quantity WHERE product_id = ?`,
                        [productId]
                    );

                    if (existingRecord) {
                        // Güncelle - product_id üzerinden
                        sqliteService.run(
                            `UPDATE product_quantity SET quantity = ? WHERE product_id = ?`,
                            [quantity, productId]
                        );
                        logger.info(`✓ SQLite product_quantity güncellendi: ProductID=${productId} (Kayit ID=${existingRecord.id}), quantity=${quantity} (önceki: ${existingRecord.quantity})`);
                    } else {
                        // Kayıt yok - product tablosunda ürün var mı kontrol et
                        const productRecord = sqliteService.queryOne(
                            `SELECT id FROM product WHERE id = ?`,
                            [productId]
                        );

                        if (productRecord) {
                            // Yeni kayıt ekle - ID'yi otomatik bırak (veya productId kullan, ama çakışma riskine dikkat)
                            // En güvenlisi ID belirtmeden eklemek, SQLite auto-increment yapar
                            sqliteService.run(
                                `INSERT INTO product_quantity (product_id, product_option_value_id, store_id, supplier, quantity, quantity2, sync_ai) 
                                 VALUES (?, 0, 0, 'Web Manuel', ?, 0, 0)`,
                                [productId, quantity]
                            );
                            logger.info(`✓ SQLite product_quantity eklendi: ProductID=${productId}, quantity=${quantity}`);
                        } else {
                            logger.warn(`⚠ SQLite product tablosunda ürün bulunamadı: ProductID=${productId}`);
                        }
                    }
                } finally {
                    sqliteService.disconnect();
                }

                entityData = recordData;

            } else {
                throw new Error(`Bilinmeyen entity tipi: ${item.entity_type}`);
            }

            // Başarılı - durumu güncelle
            await pgService.query(
                `UPDATE sync_queue 
         SET status = 'completed', 
             processed_at = NOW(),
             error_message = NULL
         WHERE id = $1`,
                [item.id]
            );

            logger.info(`✓ ${item.entity_type} senkronize edildi: ${item.entity_id}`);

        } catch (error) {
            // DETAYLI HATA LOGLAMA
            console.error('!!! ISLEM HATASI !!!');
            console.error('Tip:', item.entity_type);
            console.error('Hata Mesajı:', error.message);
            console.error('Stack:', error.stack);

            logger.error(`✗ ${item.entity_type} senkronizasyon hatası:`, error);

            // Retry sayısını artır
            const newRetryCount = item.retry_count + 1;

            if (newRetryCount >= this.maxRetries) {
                // Max retry'a ulaşıldı - failed yap
                await pgService.query(
                    `UPDATE sync_queue 
           SET status = 'failed', 
               retry_count = $1,
               error_message = $2,
               processed_at = NOW()
           WHERE id = $3`,
                    [newRetryCount, error.message, item.id]
                );
                logger.error(`✗ ${item.entity_type} max retry'a ulaştı: ${item.entity_id}`);
            } else {
                // Tekrar dene - pending'e geri al
                await pgService.query(
                    `UPDATE sync_queue 
           SET status = 'pending', 
               retry_count = $1,
               error_message = $2
           WHERE id = $3`,
                    [newRetryCount, error.message, item.id]
                );
                logger.warn(`⚠ ${item.entity_type} tekrar denenecek (${newRetryCount}/${this.maxRetries}): ${item.entity_id}`);
            }
        }
    }

    async getQueueStats() {
        const stats = await pgService.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM sync_queue
      GROUP BY status
    `);

        return stats.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
        }, {});
    }
}

// Standalone çalıştırma
if (require.main === module) {
    const worker = new SyncQueueWorker();

    // Graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('SIGINT alındı, worker durduruluyor...');
        await worker.stop();
        await pgService.disconnect();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('SIGTERM alındı, worker durduruluyor...');
        await worker.stop();
        await pgService.disconnect();
        process.exit(0);
    });

    // Worker'ı başlat
    worker.start().catch(error => {
        logger.error('Worker başlatma hatası:', error);
        process.exit(1);
    });

    // Her 30 saniyede bir istatistik göster
    setInterval(async () => {
        const stats = await worker.getQueueStats();
        logger.info('Queue İstatistikleri:', stats);
    }, 30000);
}

module.exports = SyncQueueWorker;
