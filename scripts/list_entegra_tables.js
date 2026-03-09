const sqliteService = require('../services/sqlite.service');

function checkTables() {
    sqliteService.connect(true);
    const tables = sqliteService.query("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables:', tables.map(t => t.name).join(', '));

    const pictureTables = tables.filter(t => t.name.toLowerCase().includes('pict') || t.name.toLowerCase().includes('image'));
    console.log('Picture-related Tables:', pictureTables.map(t => t.name).join(', '));

    sqliteService.disconnect();
}

checkTables();
