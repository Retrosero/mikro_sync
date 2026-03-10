const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.PG_URI });

pool.query("SELECT record_data FROM sync_queue WHERE entity_type = 'stoklar' AND operation = 'update' LIMIT 5", (err, res) => {
    if (err) {
        console.error(err);
    } else {
        res.rows.forEach((r, i) => console.log(`--- RECORD ${i} ---\n`, JSON.stringify(r.record_data, null, 2)));
    }
    pool.end();
});
