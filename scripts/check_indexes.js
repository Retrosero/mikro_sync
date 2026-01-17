require('dotenv').config();
const sqliteService = require('../services/sqlite.service');

function checkIndexes() {
    try {
        sqliteService.connect(true);
        console.log('=== product_quantity INDEXLERI ===');
        const indexes = sqliteService.query(`PRAGMA index_list('product_quantity')`);

        indexes.forEach(idx => {
            console.log(`Index: ${idx.name} (unique: ${idx.unique})`);
            const info = sqliteService.query(`PRAGMA index_info('${idx.name}')`);
            info.forEach(col => console.log(`  - ${col.name}`));
        });

        sqliteService.disconnect();
    } catch (error) {
        console.error('Hata:', error);
    }
}

checkIndexes();
