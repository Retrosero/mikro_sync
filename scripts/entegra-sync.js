/**
 * Ana Entegra SQLite -> PostgreSQL (Web) Senkronizasyon
 * 
 * Bu script db.s3db dosyasından belirli tabloları okuyup
 * web veritabanındaki entegra_ prefix'li tablolara senkronize eder.
 * 
 * Senkronizasyon Mantığı:
 * - Hedef tablo boşsa: Tüm veriyi aktar
 * - Günün ilk senkronizasyonu: Son 1 ayın verilerini güncelle
 * - Sonraki senkronizasyonlar: Son 3 günün verilerini güncelle
 * 
 * Ayrıca web'den order tablosundaki invoice_print alanı
 * 0'dan 1'e döndüyse bunu SQLite'a geri yazar.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

// Senkronize edilecek tablo listesi
// NOT: Sadece kullanılan tablolar aktif, diğerleri yorum satırında
const TABLE_MAPPING = {
    'product': 'entegra_product',
    'product_info': 'entegra_product_info',
    'category': 'entegra_category',
    // Sipariş tabloları (gerekirse aktif et)
    // 'order': 'entegra_order',
    // 'order_status': 'entegra_order_status',
    // 'order_product': 'entegra_order_product',
    // Diğer tablolar (gerekirse aktif et)
    // 'pictures': 'entegra_pictures',
    // 'product_quantity': 'entegra_product_quantity',
    // 'product_prices': 'entegra_product_prices',
    // 'messages': 'entegra_messages',
    // 'message_template': 'entegra_message_template',
    // 'customer': 'entegra_customer',
    // 'brand': 'entegra_brand',
    // 'category2': 'entegra_category2',
    // 'product_description': 'entegra_product_description'
};

// Senkronizasyon durumu dosyası
const SYNC_STATE_FILE = path.join(__dirname, '../sync-state-entegra.json');

// Tarih alanı eşlemeleri (hangi tabloda hangi tarih alanı kullanılacak)
const DATE_FIELD_MAPPING = {
    'product': 'date_change',
    'product_info': 'id',
    'category': null, // Tüm veri her zaman senkronize edilir (az kayıt)
    // Devre dışı tablolar için referans:
    // 'order': 'id',
    // 'order_product': 'order_id',
    // 'messages': 'id',
    // 'product_quantity': 'id',
    // 'product_prices': 'id',
    // 'pictures': 'id',
    // 'order_status': null,
    // 'message_template': null,
    // 'customer': 'id',
    // 'brand': null,
    // 'category2': null,
    // 'product_description': 'id'
};

// PERFORMANS: Sadece kullanılan kolonları senkronize et
const COLUMN_FILTER = {
    'product': [
        'id', 'productName', 'productCode', 'status', 'supplier', 'brand_id',
        'group', 'category2', 'date_change', 'warehouse_rack_number',
        'country_of_origin', 'gtin', 'sub_name', 'sub_name2', 'description'
    ],
    'category': [
        'id', 'name', 'name_tree'
    ],
    'product_info': [
        'product_id', 'salePrice'
    ]
};

/**
 * Senkronizasyon durumunu oku
 */
function loadSyncState() {
    try {
        if (fs.existsSync(SYNC_STATE_FILE)) {
            return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8'));
        }
    } catch (error) {
        logger.warn('Sync state dosyası okunamadı:', error.message);
    }
    return {
        lastSyncDate: null,
        lastFullSyncDate: null,
        tables: {}
    };
}

/**
 * Senkronizasyon durumunu kaydet
 */
function saveSyncState(state) {
    try {
        fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
        logger.error('Sync state dosyası yazılamadı:', error.message);
    }
}

/**
 * Bugün günün ilk senkronizasyonu mu?
 */
function isFirstSyncOfDay(state) {
    if (!state.lastSyncDate) return true;

    const lastSync = new Date(state.lastSyncDate);
    const today = new Date();

    return lastSync.toDateString() !== today.toDateString();
}

/**
 * SQLite tipini PostgreSQL tipine dönüştür
 */
function sqliteTypeToPgType(sqliteType) {
    const type = (sqliteType || 'TEXT').toUpperCase();

    if (type.includes('INT')) return 'BIGINT';
    if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return 'DOUBLE PRECISION';
    if (type.includes('BLOB')) return 'BYTEA';
    if (type.includes('BOOL')) return 'BOOLEAN';
    if (type.includes('DATETIME') || type.includes('TIMESTAMP')) return 'TIMESTAMP';
    if (type.includes('DATE')) return 'DATE';
    if (type.includes('TIME')) return 'TIME';

    return 'TEXT';
}

/**
 * PostgreSQL'de tabloyu oluştur
 */
async function createPgTable(pgTableName, columns) {
    const colDefs = columns.map(col => {
        const pgType = sqliteTypeToPgType(col.type);
        const pk = col.pk ? ' PRIMARY KEY' : '';
        const notNull = col.notnull && !col.pk ? ' NOT NULL' : '';

        // Kolon adlarını çift tırnak içine al (reserved keywords için)
        return `"${col.name}" ${pgType}${pk}${notNull}`;
    });

    const sql = `
    CREATE TABLE IF NOT EXISTS "${pgTableName}" (
      ${colDefs.join(',\n      ')}
    );
  `;

    await pgService.query(sql);
    logger.info(`PostgreSQL tablosu oluşturuldu: ${pgTableName}`);
}

/**
 * Tablodaki kayıt sayısını al
 */
async function getPgTableCount(tableName) {
    const result = await pgService.queryOne(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return result ? parseInt(result.count) : 0;
}

/**
 * Tablonun varlığını kontrol et
 */
async function pgTableExists(tableName) {
    try {
        const result = await pgService.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      ) as exists
    `, [tableName]);
        return result[0]?.exists || false;
    } catch (error) {
        return false;
    }
}

/**
 * Veri değerini temizle ve PostgreSQL'e uygun hale getir
 * @param {*} value - Temizlenecek değer
 * @param {string} columnType - Kolon tipi
 */
function cleanValue(value, columnType) {
    // null ve undefined doğrudan null döner
    if (value === null || value === undefined) return null;

    const type = (columnType || 'TEXT').toUpperCase();

    // Boş string kontrolü
    if (value === '') {
        // Numeric tipler için null döner
        if (type.includes('INT') || type.includes('REAL') ||
            type.includes('FLOAT') || type.includes('DOUBLE') ||
            type.includes('NUMERIC') || type.includes('DECIMAL')) {
            return null;
        }
        // Date/Time tipler için null döner
        if (type.includes('DATE') || type.includes('TIME') || type.includes('TIMESTAMP')) {
            return null;
        }
        // Boolean için null döner
        if (type.includes('BOOL')) {
            return null;
        }
        // Text için boş string olarak bırak
        return '';
    }

    // Numeric tipler için dönüşüm
    if (type.includes('INT')) {
        const num = parseInt(value);
        return isNaN(num) ? null : num;
    }

    if (type.includes('REAL') || type.includes('FLOAT') ||
        type.includes('DOUBLE') || type.includes('NUMERIC') || type.includes('DECIMAL')) {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }

    // Boolean için dönüşüm
    if (type.includes('BOOL')) {
        if (typeof value === 'boolean') return value;
        if (value === 1 || value === '1' || value === 'true' || value === 'TRUE') return true;
        if (value === 0 || value === '0' || value === 'false' || value === 'FALSE') return false;
        return null;
    }

    return value;
}

/**
 * Veri batch'lerini PostgreSQL'e BULK INSERT ile aktar
 * PK varsa UPSERT, yoksa sadece INSERT yapar
 */
async function upsertBatch(pgTableName, rows, columns, hasPrimaryKey = true) {
    if (rows.length === 0) return 0;

    const columnNames = columns.map(c => `"${c.name}"`).join(', ');
    const pkColumn = columns.find(c => c.pk);
    const pkName = pkColumn ? pkColumn.name : 'id';

    // Tüm değerleri ve placeholder'ları hazırla
    const allValues = [];
    const valueStrings = [];
    let paramIndex = 1;

    for (const row of rows) {
        const rowValues = columns.map(c => {
            const val = row[c.name];
            return cleanValue(val, c.type);
        });

        allValues.push(...rowValues);

        // Bu satır için placeholder'lar oluştur
        const placeholders = columns.map(() => `$${paramIndex++}`).join(', ');
        valueStrings.push(`(${placeholders})`);
    }

    let sql;
    if (hasPrimaryKey && pkColumn) {
        // UPSERT için update clause oluştur
        const updateClause = columns
            .filter(c => !c.pk)
            .map(c => `"${c.name}" = EXCLUDED."${c.name}"`)
            .join(', ');

        sql = `
            INSERT INTO "${pgTableName}" (${columnNames})
            VALUES ${valueStrings.join(', ')}
            ON CONFLICT ("${pkName}") DO UPDATE SET ${updateClause}
        `;
    } else {
        // PK yok, sadece INSERT yap
        sql = `
            INSERT INTO "${pgTableName}" (${columnNames})
            VALUES ${valueStrings.join(', ')}
        `;
    }

    try {
        await pgService.query(sql, allValues);
        return rows.length;
    } catch (error) {
        logger.error(`Bulk insert hatası (${pgTableName}): ${error.message}`);
        return 0;
    }
}

/**
 * Tek bir tabloyu senkronize et
 */
async function syncTable(sourceTable, targetTable, state, isFirstSync) {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`Senkronizasyon başlıyor: ${sourceTable} -> ${targetTable}`);
    logger.info(`${'='.repeat(60)}`);

    try {
        // SQLite tablo şemasını al
        let columns = sqliteService.getTableSchema(sourceTable);
        if (columns.length === 0) {
            logger.warn(`Tablo bulunamadı veya boş: ${sourceTable}`);
            return { success: false, reason: 'table_not_found' };
        }

        // PERFORMANS: Kolon filtresi uygula (çok kolonlu tablolar için)
        const columnFilter = COLUMN_FILTER[sourceTable];
        if (columnFilter) {
            const originalCount = columns.length;
            columns = columns.filter(c => columnFilter.includes(c.name));
            logger.info(`Kolon filtresi uygulandı: ${originalCount} -> ${columns.length} kolon`);
        }

        // PostgreSQL'de tablo var mı kontrol et
        const tableExists = await pgTableExists(targetTable);
        if (!tableExists) {
            logger.info(`PostgreSQL'de tablo oluşturuluyor: ${targetTable}`);
            await createPgTable(targetTable, columns);
        } else {
            // Tablo varsa, eksik kolonları TOPLU OLARAK kontrol et (PERFORMANS İYİLEŞTİRMESİ)
            const existingCols = await pgService.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = $1 AND table_schema = 'public'
            `, [targetTable]);
            const existingColSet = new Set(existingCols.map(c => c.column_name));

            const missingCols = columns.filter(c => !existingColSet.has(c.name));
            if (missingCols.length > 0) {
                logger.info(`${targetTable}: ${missingCols.length} eksik kolon ekleniyor...`);
                for (const col of missingCols) {
                    try {
                        const pgType = sqliteTypeToPgType(col.type);
                        await pgService.query(`ALTER TABLE "${targetTable}" ADD COLUMN IF NOT EXISTS "${col.name}" ${pgType}`);
                    } catch (colError) {
                        logger.error(`Kolon ekleme hatası (${targetTable}.${col.name}):`, colError.message);
                    }
                }
            }
        }

        // Hedef tablodaki kayıt sayısını al
        const targetCount = await getPgTableCount(targetTable);
        logger.info(`Hedef tablo (${targetTable}) mevcut kayıt sayısı: ${targetCount}`);

        // Kaynak tablodaki kayıt sayısını al
        const sourceCount = sqliteService.getRowCount(sourceTable);
        logger.info(`Kaynak tablo (${sourceTable}) toplam kayıt sayısı: ${sourceCount}`);

        let query;
        const dateField = DATE_FIELD_MAPPING[sourceTable];

        if (targetCount === 0) {
            // Hedef tablo boş - tüm veriyi aktar
            logger.info('Hedef tablo boş, TÜM VERİ aktarılacak');
            query = `SELECT * FROM '${sourceTable}'`;
        } else if (['order', 'order_product', 'messages', 'customer'].includes(sourceTable)) {
            // Kullanıcı isteği: Tablo doluysa son id/order_id'yi kontrol et ve sadece yenileri al
            const idField = sourceTable === 'order_product' ? 'order_id' : 'id';
            const result = await pgService.queryOne(`SELECT MAX("${idField}") as max_id FROM "${targetTable}"`);
            const maxId = result ? (result.max_id || 0) : 0;
            logger.info(`Hedef tablodaki son ${idField}: ${maxId}. Yeni kayıtlar aktarılacak.`);
            query = `SELECT * FROM '${sourceTable}' WHERE "${idField}" > ${maxId}`;
        } else if (sourceTable === 'product') {
            // Kullanıcı isteği: date_change alanını kontrol et ve sadece güncel verileri aktar
            const result = await pgService.queryOne(`SELECT MAX("date_change") as max_date FROM "${targetTable}"`);
            let maxDate = result?.max_date;

            if (maxDate) {
                // Date objesini SQLite formatına çevir (YYYY-MM-DD HH:mm:ss)
                if (maxDate instanceof Date) {
                    maxDate = maxDate.toISOString().replace('T', ' ').substring(0, 19);
                }
                logger.info(`Hedef tablodaki son date_change: ${maxDate}. Güncel kayıtlar aktarılacak.`);
                query = `SELECT * FROM '${sourceTable}' WHERE "date_change" > '${maxDate}'`;
            } else {
                logger.info('Hedef tabloda date_change verisi yok, TÜM VERİ aktarılacak.');
                query = `SELECT * FROM '${sourceTable}'`;
            }
        } else if (dateField === null) {
            // Tarih alanı yok ve az kayıtlı tablo - tümünü senkronize et
            logger.info('Referans tablosu, TÜM VERİ aktarılacak');
            query = `SELECT * FROM '${sourceTable}'`;
        } else if (dateField === 'id') {
            // Tarih alanı yok, ID üzerinden son kayıtları al
            const lastId = state.tables[sourceTable]?.lastId || 0;

            if (isFirstSync) {
                // Günün ilk synci - son 1 aylık kayıtları tahmin et (yaklaşık son 10000 kayıt)
                const minId = Math.max(0, lastId - 10000);
                logger.info(`Günün ilk senkronizasyonu, ID > ${minId} olan kayıtlar aktarılacak`);
                query = `SELECT * FROM '${sourceTable}' WHERE id > ${minId}`;
            } else {
                // Sonraki syncler - son 3 günlük kayıtları tahmin et (yaklaşık son 1000 kayıt)
                const minId = Math.max(0, lastId - 1000);
                logger.info(`Sonraki senkronizasyon, ID > ${minId} olan kayıtlar aktarılacak`);
                query = `SELECT * FROM '${sourceTable}' WHERE id > ${minId}`;
            }
        } else {
            // Tarih alanı var
            if (isFirstSync) {
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                const dateStr = oneMonthAgo.toISOString().split('T')[0];
                logger.info(`Günün ilk senkronizasyonu, ${dateField} >= ${dateStr} olan kayıtlar aktarılacak`);
                query = `SELECT * FROM '${sourceTable}' WHERE "${dateField}" >= '${dateStr}'`;
            } else {
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                const dateStr = threeDaysAgo.toISOString().split('T')[0];
                logger.info(`Sonraki senkronizasyon, ${dateField} >= ${dateStr} olan kayıtlar aktarılacak`);
                query = `SELECT * FROM '${sourceTable}' WHERE "${dateField}" >= '${dateStr}'`;
            }
        }

        // Veriyi oku
        const rows = sqliteService.query(query);
        logger.info(`Aktarılacak kayıt sayısı: ${rows.length}`);

        if (rows.length === 0) {
            logger.info('Aktarılacak kayıt yok');
            return { success: true, count: 0 };
        }

        // PK kontrolü
        const pkColumn = columns.find(c => c.pk);
        const hasPrimaryKey = !!pkColumn;

        // PK yoksa ve güncelleme yapılacaksa önce tabloyu temizle
        // PERFORMANS: Sadece günün ilk senkronizasyonunda veya kayıt varsa temizle
        if (!hasPrimaryKey && targetCount > 0 && (isFirstSync || rows.length > 0)) {
            logger.info(`PK yok, tablo temizleniyor: ${targetTable}`);
            await pgService.query(`TRUNCATE TABLE "${targetTable}"`);
        }

        // Batch'ler halinde aktar
        // PostgreSQL max 65535 parametre destekler, kolon sayısına göre batch boyutu hesapla
        const MAX_PARAMS = 60000; // Biraz pay bırak
        const BATCH_SIZE = Math.max(10, Math.floor(MAX_PARAMS / columns.length));
        let totalInserted = 0;

        logger.info(`Kolon sayısı: ${columns.length}, Batch boyutu: ${BATCH_SIZE}, PK: ${hasPrimaryKey ? pkColumn.name : 'YOK'}`);

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const insertedCount = await upsertBatch(targetTable, batch, columns, hasPrimaryKey);
            totalInserted += insertedCount;
            const progress = Math.round((i + batch.length) / rows.length * 100);
            logger.info(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertedCount} kayıt aktarıldı (${progress}%)`);
        }

        // Son ID'yi kaydet
        if (dateField === 'id' && rows.length > 0) {
            const maxId = Math.max(...rows.map(r => r.id));
            state.tables[sourceTable] = { lastId: maxId };
        }

        logger.info(`Toplam aktarılan kayıt: ${totalInserted}`);
        return { success: true, count: totalInserted };

    } catch (error) {
        logger.error(`Tablo senkronizasyon hatası (${sourceTable}):`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Web'den SQLite'a invoice_print güncellemelerini yaz
 */
async function syncInvoicePrintToSQLite() {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info('invoice_print güncellemeleri kontrol ediliyor...');
    logger.info(`${'='.repeat(60)}`);

    try {
        // Web'deki invoice_print = 1 olan kayıtları al
        const webOrders = await pgService.query(`
      SELECT id, invoice_print 
      FROM "entegra_order" 
      WHERE invoice_print = 1
    `);

        if (webOrders.length === 0) {
            logger.info('Güncellenecek invoice_print kaydı yok');
            return { updated: 0 };
        }

        logger.info(`Web'de invoice_print=1 olan ${webOrders.length} kayıt bulundu`);

        // Tek bir transaction içinde toplu güncelleme
        let updatedCount = 0;
        const db = sqliteService.connect(false);
        const updateStmt = db.prepare(`UPDATE 'order' SET invoice_print = 1 WHERE id = ? AND (invoice_print IS NULL OR invoice_print != 1)`);

        const updateTransaction = db.transaction((orders) => {
            for (const order of orders) {
                const info = updateStmt.run(order.id);
                if (info.changes > 0) updatedCount++;
            }
        });

        updateTransaction(webOrders);

        logger.info(`Toplam ${updatedCount} kayıt SQLite'da güncellendi (Transaction ile)`);
        return { updated: updatedCount };

    } catch (error) {
        logger.error('invoice_print senkronizasyon hatası:', error);
        return { error: error.message };
    }
}

/**
 * Ana senkronizasyon fonksiyonu
 */
async function runSync(options = { disconnect: true }) {
    logger.info('\n' + '='.repeat(80));
    logger.info('ANA ENTEGRA SENKRONIZASYON BAŞLIYOR');
    logger.info('Tarih: ' + new Date().toISOString());
    logger.info('='.repeat(80) + '\n');

    const startTime = Date.now();

    try {
        // SQLite bağlantısını aç (yazma modu)
        sqliteService.connect(false);

        // Sync durumunu oku
        const state = loadSyncState();
        const isFirstSync = isFirstSyncOfDay(state);

        logger.info(`Günün ilk senkronizasyonu: ${isFirstSync ? 'EVET (son 1 ay)' : 'HAYIR (son 3 gün)'}`);

        // Her tabloyu senkronize et (Paralel Çalıştırma - 3'erli gruplar halinde)
        const entries = Object.entries(TABLE_MAPPING);
        const results = {};
        const CONCURRENCY = 3;

        for (let i = 0; i < entries.length; i += CONCURRENCY) {
            const chunk = entries.slice(i, i + CONCURRENCY);
            await Promise.all(chunk.map(async ([sourceTable, targetTable]) => {
                results[sourceTable] = await syncTable(sourceTable, targetTable, state, isFirstSync);
            }));
        }

        // invoice_print güncellemelerini yaz
        const invoicePrintResult = await syncInvoicePrintToSQLite();
        results['invoice_print_sync'] = invoicePrintResult;

        // Sync durumunu güncelle ve kaydet
        state.lastSyncDate = new Date().toISOString();
        if (isFirstSync) {
            state.lastFullSyncDate = state.lastSyncDate;
        }
        saveSyncState(state);

        const duration = Date.now() - startTime;

        // Özet
        logger.info('\n' + '='.repeat(80));
        logger.info('SENKRONIZASYON TAMAMLANDI');
        logger.info('='.repeat(80));
        logger.info(`Toplam süre: ${(duration / 1000).toFixed(2)} saniye`);
        logger.info('\nTablo sonuçları:');

        for (const [table, result] of Object.entries(results)) {
            if (result.success !== undefined) {
                logger.info(`  ${table}: ${result.success ? '✓' : '✗'} - ${result.count || 0} kayıt`);
            } else if (result.updated !== undefined) {
                logger.info(`  ${table}: ${result.updated} güncelleme`);
            }
        }

        return results;

    } catch (error) {
        logger.error('Senkronizasyon hatası:', error);
        throw error;
    } finally {
        sqliteService.disconnect();
        if (options.disconnect) {
            await pgService.disconnect();
        }
    }
}

// Script doğrudan çalıştırıldığında
if (require.main === module) {
    runSync()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Hata:', error);
            process.exit(1);
        });
}

module.exports = { runSync, TABLE_MAPPING };
