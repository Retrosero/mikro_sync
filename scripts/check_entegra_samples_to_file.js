const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

function check() {
    sqliteService.connect(true);
    const tables = ['order', 'product_prices', 'product_quantity', 'product_info', 'pictures', 'product_description'];
    let output = '';
    tables.forEach(t => {
        try {
            const sample = sqliteService.query(`SELECT * FROM "${t}" LIMIT 1`);
            output += `--- ${t} Sample ---\n${JSON.stringify(sample, null, 2)}\n\n`;
        } catch (e) {
            output += `Error reading ${t}: ${e.message}\n\n`;
        }
    });
    fs.writeFileSync('samples_output.txt', output);
    sqliteService.disconnect();
}

check();
