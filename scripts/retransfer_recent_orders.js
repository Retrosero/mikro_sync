/**
 * Bugün ve dünkü siparişleri db.s3db'den entegra_order tablosuna tekrar aktarır (UPSERT).
 */
require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

// SQLite -> PG Tablo Eşlemesi
const TABLES = {
    'order': 'entegra_order',
    'order_product': 'entegra_order_product'
};

/**
 * SQLite tipini PostgreSQL tipine dönüştür
 */
function sqliteTypeToPgType(sqliteType) {
    const type = (sqliteType || 'TEXT').toUpperCase();

    if (type.includes('INT')) return 'INTEGER';
    if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return 'DOUBLE PRECISION';
    if (type.includes('BLOB')) return 'BYTEA';
    if (type.includes('BOOL')) return 'BOOLEAN';
    if (type.includes('DATETIME') || type.includes('TIMESTAMP')) return 'TIMESTAMP';
    if (type.includes('DATE')) return 'DATE';
    if (type.includes('TIME')) return 'TIME';

    return 'TEXT';
}

/**
 * Veri değerini temizle ve PostgreSQL'e uygun hale getir
 */
function cleanValue(value, columnType) {
    if (value === null || value === undefined) return null;
    const type = (columnType || 'TEXT').toUpperCase();

    if (value === '') {
        if (type.includes('INT') || type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE') ||
            type.includes('NUMERIC') || type.includes('DECIMAL') || type.includes('DATE') ||
            type.includes('TIME') || type.includes('TIMESTAMP') || type.includes('BOOL')) {
            return null;
        }
        return '';
    }

    if (type.includes('INT')) {
        const num = parseInt(value);
        return isNaN(num) ? null : num;
    }

    if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('NUMERIC')) {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }

    if (type.includes('BOOL')) {
        if (typeof value === 'boolean') return value;
        if (value === 1 || value === '1' || value === 'true' || value === 'TRUE') return true;
        if (value === 0 || value === '0' || value === 'false' || value === 'FALSE') return false;
        return null;
    }

    return value;
}

/**
 * UPSERT Batch işlemi
 */
async function upsertBatch(pgTableName, rows, columns) {
    if (rows.length === 0) return 0;

    const columnNames = columns.map(c => `"${c.name}"`).join(', ');
    const pkColumn = columns.find(c => c.pk);
    const pkName = pkColumn ? pkColumn.name : 'id';

    const allValues = [];
    const valueStrings = [];
    let paramIndex = 1;

    for (const row of rows) {
        const rowValues = columns.map(c => cleanValue(row[c.name], c.type));
        allValues.push(...rowValues);
        const placeholders = columns.map(() => `$${paramIndex++}`).join(', ');
        valueStrings.push(`(${placeholders})`);
    }

    // UPDATE clause - PK dışındaki tüm kolonlar
    const updateClause = columns
        .filter(c => !c.pk)
        .map(c => `"${c.name}" = EXCLUDED."${c.name}"`)
        .join(', ');

    const sql = `
        INSERT INTO "${pgTableName}" (${columnNames})
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT ("${pkName}") DO UPDATE SET ${updateClause}
    `;

    try {
        await pgService.query(sql, allValues);
        return rows.length;
    } catch (error) {
        logger.error(`Bulk UPSERT hatası (${pgTableName}): ${error.message}`);
        throw error;
    }
}

async function runReSync() {
    logger.info('Bugün ve dünkü siparişler tekrar aktarılıyor...');

    // Tarihleri ayarla
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0] + ' 00:00:00';

    logger.info(`Başlangıç tarihi: ${dateStr}`);

    try {
        sqliteService.connect(true);

        // 1. Order Tablosu
        logger.info('order tablosu işleniyor...');
        const orderCols = sqliteService.getTableSchema('order');
        const orders = sqliteService.query(`SELECT * FROM 'order' WHERE date_add >= ?`, [dateStr]);

        logger.info(`${orders.length} sipariş bulundu.`);

        if (orders.length > 0) {
            // Batch boyutu hesapla
            const BATCH_SIZE = Math.floor(60000 / orderCols.length);
            let totalOrderInserted = 0;

            for (let i = 0; i < orders.length; i += BATCH_SIZE) {
                const batch = orders.slice(i, i + BATCH_SIZE);
                totalOrderInserted += await upsertBatch('entegra_order', batch, orderCols);
                logger.info(`Order Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${totalOrderInserted}/${orders.length} aktarıldı`);
            }
        }

        // 2. Order Product Tablosu
        logger.info('order_product tablosu işleniyor...');
        const orderProdCols = sqliteService.getTableSchema('order_product');
        // date_add join ile filtrele
        const orderProducts = sqliteService.query(`
            SELECT op.* FROM order_product op 
            INNER JOIN 'order' o ON op.order_id = o.id 
            WHERE o.date_add >= ?
        `, [dateStr]);

        logger.info(`${orderProducts.length} sipariş kalemi bulundu.`);

        if (orderProducts.length > 0) {
            const BATCH_SIZE_PROD = Math.floor(60000 / orderProdCols.length);
            let totalProdInserted = 0;

            for (let i = 0; i < orderProducts.length; i += BATCH_SIZE_PROD) {
                const batch = orderProducts.slice(i, i + BATCH_SIZE_PROD);
                totalProdInserted += await upsertBatch('entegra_order_product', batch, orderProdCols);
                logger.info(`Order Product Batch ${Math.floor(i / BATCH_SIZE_PROD) + 1}: ${totalProdInserted}/${orderProducts.length} aktarıldı`);
            }
        }

        logger.info('Senkronizasyon başarıyla tamamlandı.');
    } catch (error) {
        logger.error('Senkronizasyon sırasında hata oluştu:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
    }
}

runReSync();
