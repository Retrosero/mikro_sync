const postgres = require('./services/postgresql.service');
const fs = require('fs');

async function main() {
    let output = '';
    const log = (msg) => { output += msg + '\n'; console.log(msg); };
    try {
        log('Checking Postgres...');
        const pgCols = await postgres.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE column_name ILIKE '%stok2%' OR column_name ILIKE '%stok_2%'
        `);
        log('Postgres matching columns: ' + JSON.stringify(pgCols));

        const catCols = await postgres.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'kategoriler'
        `);
        log('Postgres kategoriler cols: ' + JSON.stringify(catCols));

        // Attempt basic category query
        const cats = await postgres.query(`SELECT * FROM kategoriler LIMIT 10`);
        log('Cats sample: ' + JSON.stringify(cats));

        // Find products with missing categories
        // Let's get STOK tables
        const stokCols = await postgres.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stoklar'
        `);
        log('Stoklar cols: ' + JSON.stringify(stokCols));

    } catch (e) {
        log('Error: ' + e.message);
    } finally {
        await postgres.disconnect();
        fs.writeFileSync('tmp_db_check_result.txt', output, 'utf8');
    }
}
main();
