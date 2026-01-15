const sqliteService = require('./services/sqlite.service');

async function checkSchema() {
    try {
        sqliteService.connect(true);
        const columns = sqliteService.getTableSchema('product');
        const search = columns.map(c => c.name).filter(n =>
            n.toLowerCase().includes('kod') ||
            n.toLowerCase().includes('code') ||
            n.toLowerCase().includes('sku') ||
            n.toLowerCase().includes('model')
        );
        console.log('Bulunan Kolonlar:', search);

        // Örnek bir kayıt çekelim
        const row = sqliteService.queryOne('SELECT * FROM product LIMIT 1');
        if (row) {
            console.log('Örnek Kayıt Kodları:', {
                id: row.id,
                productCode: row.productCode,
                code: row.code,
                model: row.model
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        sqliteService.disconnect();
    }
}

checkSchema();
