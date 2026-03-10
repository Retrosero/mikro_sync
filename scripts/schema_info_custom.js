const db = require('better-sqlite3')('C:\\\\Ana Entegra\\\\db.s3db', { readonly: true });
console.log("--- PICTURES INFO ---");
const picInfo = db.pragma("table_info('pictures')");
console.log(picInfo);

const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.PG_URI });
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stoklar'", (err, res) => {
    console.log("--- STOKLAR INFO ---");
    if (err) console.error(err);
    else console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`));
    
    pool.end();
});
