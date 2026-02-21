const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT),
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: false
});

async function main() {
    try {
        // entegra_product columns
        console.log('=== entegra_product SCHEMA ===');
        const cols = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'entegra_product'
            ORDER BY ordinal_position
        `);
        cols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')'));

        // Sample
        console.log('\n=== entegra_product SAMPLE (1 row) ===');
        const sample = await pool.query('SELECT * FROM entegra_product LIMIT 1');
        if (sample.rows.length > 0) {
            Object.keys(sample.rows[0]).forEach(k => console.log('  ' + k + ' = ' + sample.rows[0][k]));
        }

        // Count
        const cnt = await pool.query('SELECT COUNT(*) as c FROM entegra_product');
        console.log('\nTotal entegra_product: ' + cnt.rows[0].c);

        // Check if entegra_product_delete table exists
        const delTable = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_name LIKE '%product_delete%' OR table_name LIKE '%delete_product%'
        `);
        console.log('\n=== DELETE-RELATED TABLES IN PG ===');
        delTable.rows.forEach(r => console.log('  ' + r.table_name));
        if (delTable.rows.length === 0) console.log('  (none found)');

    } catch (e) {
        console.error('Error:', e.message);
    }
    pool.end();
}

main();
