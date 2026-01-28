const pgService = require('./services/postgresql.service');
const fs = require('fs');

async function inspectPgEntegraTables() {
    const output = [];
    const tables = [
        'entegra_brand', 'entegra_category', 'entegra_pictures',
        'entegra_product_description', 'entegra_product_prices', 'entegra_product_quantity',
        'entegra_product' // Bunu da ekleyelim
    ];

    try {
        for (const tbl of tables) {
            const cols = await pgService.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = '${tbl}'
      `);

            output.push(`\n=== ${tbl} ===`);
            cols.forEach(c => output.push(`${c.column_name} (${c.data_type}) [${c.is_nullable}]`));
        }
    } catch (e) { output.push(e.message); }

    fs.writeFileSync('pg_entegra_schema.txt', output.join('\n'));
    process.exit(0);
}

inspectPgEntegraTables();
