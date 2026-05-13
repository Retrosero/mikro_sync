const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
require('dotenv').config();

async function check() {
    try {
        sqliteService.connect(true);
        const sqliteOrder = sqliteService.queryOne("SELECT MAX(id) as max_id, MAX(date_change) as max_date FROM 'order'");
        console.log('SQLite Order Max:', sqliteOrder);

        const pgOrder = await pgService.queryOne('SELECT MAX(id) as max_id, MAX(date_change) as max_date FROM "entegra_order"');
        console.log('PG Order Max:', pgOrder);

        const recentSqlite = sqliteService.query("SELECT id, date_change, date_add FROM 'order' ORDER BY id DESC LIMIT 5");
        console.log('Recent SQLite Orders:', recentSqlite);

        const recentPg = await pgService.query('SELECT id, date_change FROM "entegra_order" ORDER BY id DESC LIMIT 5');
        console.log('Recent PG Orders:', recentPg);

    } catch (error) {
        console.error(error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
    }
}

check();
