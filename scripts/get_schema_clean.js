const fs = require('fs');
const db = require('better-sqlite3')('C:\\\\Ana Entegra\\\\db.s3db', { readonly: true });
const picInfo = db.pragma("table_info('pictures')");
fs.writeFileSync('schema_clean.txt', '--- PICTURES ---\n' + JSON.stringify(picInfo, null, 2) + '\n');

const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.PG_URI });
pool.query("SELECT * FROM stoklar LIMIT 1", (err, res) => {
    if (!err && res.rows.length > 0) {
        fs.appendFileSync('schema_clean.txt', '\n--- STOKLAR ROW ---\n' + JSON.stringify(res.rows[0], null, 2) + '\n');
    }
    pool.end();
});
