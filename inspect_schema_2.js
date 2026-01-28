const pgService = require('./services/postgresql.service');
const sqliteService = require('./services/sqlite.service');
const fs = require('fs');

async function inspect() {
    const output = [];

    // PG Tables List
    try {
        const tables = await pgService.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        output.push('=== PG Tables ===');
        output.push(tables.map(t => t.table_name).join(', '));
    } catch (e) { output.push(e.message); }

    // SQLite Tables
    const sqliteTables = ['product_prices', 'product_quantity', 'product_description', 'brand', 'category'];

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

    fs.writeFileSync('schema_info_2.txt', output.join('\n'));
    process.exit(0);
}

inspect();
