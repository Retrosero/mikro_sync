const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

function check() {
    sqliteService.connect(true);
    const tables = ['product_prices', 'product_quantity', 'product_description', 'pictures', 'product_info'];
    let output = '';
    tables.forEach(t => {
        const cols = sqliteService.getTableSchema(t);
        output += `--- ${t} ---\n`;
        output += cols.map(c => c.name).join(', ') + '\n\n';
    });
    fs.writeFileSync('cols_output.txt', output);
    sqliteService.disconnect();
}

check();
