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
        SELECT id, entity_type, entity_id, operation, retry_count
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
            // 'entegra_product_manual' kaldırıldı - artık SQLite'a yazılıyor
            'entegra_order',
            'entegra_order_status',
            'entegra_order_product',
            'entegra_pictures',
            'entegra_product_quantity',
            'entegra_product_prices',
            'entegra_product',
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
                    throw new Error(`Satış bulunamadı: ${item.entity_id}`);
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
                    throw new Error(`Tahsilat bulunamadı: ${item.entity_id}`);
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
                    throw new Error(`Alış bulunamadı: ${item.entity_id}`);
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
                    throw new Error(`İade bulunamadı: ${item.entity_id}`);
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
                    throw new Error(`Stok Hareketi bulunamadı: ${item.entity_id}`);
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
                    throw new Error(`Stok bulunamadı: ${item.entity_id}`);
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
                    throw new Error(`Barkod bulunamadı: ${item.entity_id}`);
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
