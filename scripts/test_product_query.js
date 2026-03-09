const pgService = require('../services/postgresql.service');
const sqliteService = require('../services/sqlite.service');

async function testProductQuery() {
    try {
        sqliteService.connect(true);
        const res = await pgService.queryOne('SELECT MAX(date_change) as max_date FROM entegra_product');
        let maxDate = res.max_date;
        console.log('PG Raw Max Date:', maxDate);
        if (maxDate instanceof Date) {
            maxDate = maxDate.toISOString().replace('T', ' ').substring(0, 19);
        }
        console.log('PG Formatted Max Date:', maxDate);

        const testRows = sqliteService.query(`SELECT id, productCode, date_change FROM product WHERE date_change > ? LIMIT 5`, [maxDate]);
        console.log('Test Rows from SQLite:', JSON.stringify(testRows, null, 2));

        const count = sqliteService.queryOne(`SELECT COUNT(*) as c FROM product WHERE date_change > ?`, [maxDate]);
        console.log('Total Count to sync:', count.c);

    } catch (err) {
        console.error(err);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
    }
}

testProductQuery();
