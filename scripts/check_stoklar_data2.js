const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    ssl: false
});

pool.query("SELECT record_data FROM sync_queue WHERE entity_type = 'stoklar' AND operation = 'update' LIMIT 3", (err, res) => {
    if (err) {
        console.error(err);
    } else {
        res.rows.forEach((r, i) => console.log(`--- RECORD ${i} ---\n`, JSON.stringify(r.record_data, null, 2)));
    }
    pool.end();
});
