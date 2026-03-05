require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');

// SQLite tipini PostgreSQL tipine dönüştür
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

async function fixMissingColumns() {
    console.log('Eksik kolonlar kontrol ediliyor...');
    try {
        sqliteService.connect(true);

        const TABLE_MAPPING = {
            'order': 'entegra_order',
            'order_status': 'entegra_order_status',
            'order_product': 'entegra_order_product',
            'pictures': 'entegra_pictures',
            'product_quantity': 'entegra_product_quantity',
            'product_prices': 'entegra_product_prices',
            'product': 'entegra_product',
            'product_info': 'entegra_product_info',
            'messages': 'entegra_messages',
            'message_template': 'entegra_message_template',
            'customer': 'entegra_customer',
            'brand': 'entegra_brand',
            'category': 'entegra_category',
            'category2': 'entegra_category2',
            'product_description': 'entegra_product_description'
        };

        for (const [sourceTable, targetTable] of Object.entries(TABLE_MAPPING)) {
            // Check if table exists in PG
            const tableExistsReq = await pgService.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                ) as exists
            `, [targetTable]);

            const tableExists = tableExistsReq[0]?.exists;
            if (!tableExists) continue;

            // Get PG columns
            const pgColsReq = await pgService.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = $1
            `, [targetTable]);

            const pgCols = pgColsReq.map(c => c.column_name);

            // Get SQLite columns
            const sqliteCols = sqliteService.getTableSchema(sourceTable);

            for (const col of sqliteCols) {
                if (!pgCols.includes(col.name)) {
                    console.log(`[${targetTable}] Eksik kolon bulundu: ${col.name} (${col.type})`);
                    const pgType = sqliteTypeToPgType(col.type);

                    try {
                        await pgService.query(`ALTER TABLE "${targetTable}" ADD COLUMN "${col.name}" ${pgType}`);
                        console.log(`-> "${col.name}" kolonu "${targetTable}" tablosuna EKLENDİ.`);
                    } catch (err) {
                        console.error(`-> HATA: Kolon eklenemedi: ${err.message}`);
                    }
                }
            }
        }

    } catch (e) {
        console.error('Script hatası:', e);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
        console.log('İşlem tamamlandı.');
    }
}

fixMissingColumns();
