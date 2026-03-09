const pgService = require('../services/postgresql.service');

async function checkEntegraConstraints() {
    const tables = [
        'entegra_order', 'entegra_order_status', 'entegra_order_product',
        'entegra_pictures', 'entegra_product_quantity', 'entegra_product_prices',
        'entegra_product', 'entegra_product_info', 'entegra_messages',
        'entegra_message_template', 'entegra_customer', 'entegra_brand',
        'entegra_category', 'entegra_category2', 'entegra_product_description'
    ];

    for (const table of tables) {
        try {
            const res = await pgService.query(`
        SELECT conname, contype 
        FROM pg_constraint 
        WHERE conrelid = '${table}'::regclass;
      `);
            console.log(`Table: ${table}`);
            console.log(`  Constraints:`, JSON.stringify(res));

            const indexes = await pgService.query(`
        SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '${table}';
      `);
            console.log(`  Indexes:`, JSON.stringify(indexes));
        } catch (err) {
            console.error(`  Error checking ${table}:`, err.message);
        }
    }
    await pgService.disconnect();
}

checkEntegraConstraints();
