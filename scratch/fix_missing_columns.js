const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
require('dotenv').config();

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

async function checkMissingColumns() {
    try {
        sqliteService.connect(true);
        
        for (const [sourceTable, targetTable] of Object.entries(TABLE_MAPPING)) {
            console.log(`Checking ${sourceTable} -> ${targetTable}...`);
            const sqliteCols = sqliteService.getTableSchema(sourceTable);
            
            // Get PG columns
            const pgColsResult = await pgService.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [targetTable]);
            
            const pgColNames = pgColsResult.map(c => c.column_name);
            
            const missing = sqliteCols.filter(sc => !pgColNames.includes(sc.name));
            
            if (missing.length > 0) {
                console.log(`Missing columns in ${targetTable}:`, missing.map(m => m.name));
                for (const col of missing) {
                    const pgType = sqliteTypeToPgType(col.type);
                    const alterSql = `ALTER TABLE "${targetTable}" ADD COLUMN "${col.name}" ${pgType}`;
                    console.log(`Running: ${alterSql}`);
                    await pgService.query(alterSql);
                }
            } else {
                console.log(`No missing columns in ${targetTable}.`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
    }
}

checkMissingColumns();
