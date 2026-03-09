const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
const { TABLE_MAPPING } = require('./entegra-sync');

async function diagnoseEntegraSync() {
    try {
        console.log('--- ENTEGRA SYNC DIAGNOSIS ---');

        // Connect
        sqliteService.connect(true); // readonly

        for (const [source, target] of Object.entries(TABLE_MAPPING)) {
            console.log(`\nTable: ${source} -> ${target}`);

            // SQLite count
            try {
                const sCount = sqliteService.getRowCount(source);
                console.log(`  SQLite Count: ${sCount}`);

                if (source === 'product') {
                    const lastFive = sqliteService.query(`SELECT id, productCode, date_change FROM product ORDER BY date_change DESC LIMIT 5`);
                    console.log(`  SQLite Last 5 date_change:`, JSON.stringify(lastFive, null, 2));
                } else {
                    const lastOne = sqliteService.queryOne(`SELECT * FROM '${source}' ORDER BY id DESC LIMIT 1`);
                    console.log(`  SQLite Last ID:`, lastOne ? lastOne.id : 'N/A');
                }
            } catch (err) {
                console.error(`  SQLite Error for ${source}:`, err.message);
            }

            // PG count
            try {
                const result = await pgService.query(`SELECT COUNT(*) as count FROM "${target}"`);
                console.log(`  PG Count: ${result[0].count}`);

                if (source === 'product') {
                    const pgLast = await pgService.query(`SELECT "productCode", "date_change" FROM "${target}" ORDER BY "date_change" DESC LIMIT 1`);
                    console.log(`  PG Last date_change:`, JSON.stringify(pgLast, null, 2));
                } else {
                    const idField = source === 'order_product' ? 'order_id' : 'id';
                    const pgLast = await pgService.query(`SELECT MAX("${idField}") as max_id FROM "${target}"`);
                    console.log(`  PG Max ${idField}:`, pgLast[0].max_id);
                }
            } catch (err) {
                console.error(`  PG Error for ${target}:`, err.message);
            }
        }

    } catch (error) {
        console.error('Diagnosis failed:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
    }
}

diagnoseEntegraSync();
