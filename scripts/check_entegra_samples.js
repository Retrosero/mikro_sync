const sqliteService = require('../services/sqlite.service');

function check() {
    sqliteService.connect(true);
    const tables = ['order', 'product_prices', 'product_quantity', 'product_info', 'pictures', 'product_description'];
    tables.forEach(t => {
        try {
            const sample = sqliteService.query(`SELECT * FROM "${t}" LIMIT 1`);
            console.log(`--- ${t} Sample ---`);
            console.log(JSON.stringify(sample, null, 2));
        } catch (e) {
            console.log(`Error reading ${t}: ${e.message}`);
        }
    });
    sqliteService.disconnect();
}

check();
