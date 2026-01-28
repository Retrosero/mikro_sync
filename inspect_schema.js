const pgService = require('./services/postgresql.service');
const sqliteService = require('./services/sqlite.service');
const fs = require('fs');

async function inspect() {
    const output = [];

    // PG Stoklar
    try {
        const cols = await pgService.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stoklar'");
        output.push('=== PG stoklar ===');
        cols.forEach(c => output.push(`${c.column_name} (${c.data_type})`));
    } catch (e) { output.push(e.message); }

    // SQLite Tables
    const sqliteTables = [
        'product', 'brand', 'category', 'category2', 'pictures',
        'product_description', 'product_prices', 'product_quantity'
    ];

    try {
        sqliteService.connect(true); // readonly
        for (const tbl of sqliteTables) {
            output.push(`\n=== SQLite ${tbl} ===`);
            try {
                const schema = sqliteService.getTableSchema(tbl);
                schema.forEach(c => output.push(`${c.name} (${c.type})`));
            } catch (e) {
                output.push(`Error: ${e.message}`);
            }
        }
    } catch (e) { output.push(e.message); }

    fs.writeFileSync('schema_info.txt', output.join('\n'));
    process.exit(0);
}

inspect();
