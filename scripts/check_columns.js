const sqliteService = require('../services/sqlite.service');
const { TABLE_MAPPING } = require('./entegra-sync');

function checkAllSchemas() {
    sqliteService.connect(true);
    for (const [source, target] of Object.entries(TABLE_MAPPING)) {
        const columns = sqliteService.getTableSchema(source);
        const names = columns.map(c => c.name);
        console.log(`${source}: ${names.join(', ')} (PK: ${columns.filter(c => c.pk === 1).map(c => c.name).join(', ')})`);
    }
}

checkAllSchemas();
