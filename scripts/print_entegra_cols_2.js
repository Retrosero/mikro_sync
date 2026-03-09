const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

function check() {
    sqliteService.connect(true);
    const tables = ['order', 'order_status', 'order_product', 'messages', 'customer'];
    let output = '';
    tables.forEach(t => {
        const cols = sqliteService.getTableSchema(t);
        output += `--- ${t} ---\n`;
        output += cols.map(c => c.name).join(', ') + '\n\n';
    });
    fs.writeFileSync('cols_output_2.txt', output);
    sqliteService.disconnect();
}

check();
