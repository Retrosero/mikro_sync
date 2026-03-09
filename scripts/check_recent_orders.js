const sqliteService = require('../services/sqlite.service');

function check() {
    sqliteService.connect(true);
    const rows = sqliteService.query('SELECT id, no, datetime, date_change FROM "order" ORDER BY id DESC LIMIT 10');
    console.log(JSON.stringify(rows, null, 2));
    sqliteService.disconnect();
}

check();
