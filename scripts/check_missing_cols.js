
const sqlite = require('../services/sqlite.service');
const pg = require('../services/postgresql.service');

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

async function check() {
    try {
        sqlite.connect(true);
        
        for (const [sourceTable, targetTable] of Object.entries(TABLE_MAPPING)) {
            console.log(`\nChecking mapping: ${sourceTable} -> ${targetTable}`);
            const sqliteColsAll = sqlite.getTableSchema(sourceTable);
            if (sqliteColsAll.length === 0) {
                console.log(`  Source table ${sourceTable} not found or empty.`);
                continue;
            }
            
            const pgColsRes = await pg.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${targetTable}'`);
            if (pgColsRes.length === 0) {
                console.log(`  Target table ${targetTable} not found in PG.`);
                continue;
            }
            
            const pgCols = pgColsRes.map(c => c.column_name);
            const missing = sqliteColsAll.filter(c => !pgCols.includes(c.name));
            
            if (missing.length > 0) {
                console.log(`  Missing columns in ${targetTable}:`, missing.map(m => m.name).join(', '));
                missing.forEach(col => {
                    let pgType = 'TEXT';
                    const type = (col.type || 'TEXT').toUpperCase();
                    if (type.includes('INT')) pgType = 'INTEGER';
                    else if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) pgType = 'DOUBLE PRECISION';
                    else if (type.includes('BOOL')) pgType = 'BOOLEAN';
                    
                    console.log(`  ALTER TABLE "${targetTable}" ADD COLUMN "${col.name}" ${pgType};`);
                });
            } else {
                console.log(`  ✓ All columns match.`);
            }
        }
        
    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
}

check();
