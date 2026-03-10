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

pool.query("SELECT resim_url FROM stoklar WHERE resim_url IS NOT NULL LIMIT 5", (err, res) => {
    if (!err) {
        console.log("Samples:", res.rows.map(r => r.resim_url));
    } else {
        console.error(err);
    }
    pool.end();
});
