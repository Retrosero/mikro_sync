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

pool.query("SELECT * FROM stoklar WHERE ek_resimler IS NOT NULL LIMIT 1", (err, res) => {
    if (!err && res.rows.length > 0) {
        console.log("KEYS:", Object.keys(res.rows[0]));
        console.log("ANA_RESIM:", res.rows[0].ana_resim);
        console.log("EK_RESIMLER:", res.rows[0].ek_resimler);
    }
    pool.end();
});
