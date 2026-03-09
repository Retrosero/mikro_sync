const sqliteService = require('../services/sqlite.service');

function check() {
    sqliteService.connect(true);
    const tables = ['product_prices', 'product_quantity', 'product_description', 'pictures', 'product_info'];
    tables.forEach(t => {
        const cols = sqliteService.getTableSchema(t);
        console.log(`--- ${t} ---`);
        console.log(cols.map(c => c.name).join(', '));
    });
    sqliteService.disconnect();
}

check();
