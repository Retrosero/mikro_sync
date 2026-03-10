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

pool.query("SELECT * FROM stoklar LIMIT 1", (err, res) => {
    if (err) {
        console.error(err);
    } else {
        if (res.rows.length > 0) {
            console.log("--- STOKLAR ROW ---");
            console.log(JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log("stoklar is empty");
        }
    }
    pool.end();
});
