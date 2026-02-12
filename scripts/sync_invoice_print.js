require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

async function syncInvoicePrint() {
    console.log('Starting invoice_print synchronization...');

    try {
        // 1. Get IDs from PostgreSQL entegra_order where invoice_print = 1
        console.log('Fetching orders from PostgreSQL with invoice_print = 1...');
        const pgOrders = await pgService.query(`
            SELECT id 
            FROM entegra_order 
            WHERE invoice_print = 1
        `);

        if (pgOrders.length === 0) {
            console.log('No orders found with invoice_print = 1 in PostgreSQL.');
            return;
        }

        const idsToUpdate = pgOrders.map(o => o.id);
        console.log(`Found ${idsToUpdate.length} orders in PostgreSQL.`);

        // 2. Connect to SQLite
        sqliteService.connect(false); // Read-write mode

        // 3. Batch update SQLite
        const BATCH_SIZE = 500;
        let totalUpdated = 0;

        // Check if column exists first
        try {
            sqliteService.queryOne(`SELECT invoice_print FROM 'order' LIMIT 1`);
        } catch (e) {
            console.error('Error: "invoice_print" column does not exist in SQLite "order" table or table is empty/inaccessible.');
            console.error(e.message);
            return;
        }

        console.log('Updating SQLite...');

        const sqliteDb = sqliteService.db;

        // Prepare statement for better performance
        // But for IN clause with variable length, we might just construct SQL
        // Or loop and update. Updating one by one in a transaction is also fast in SQLite.

        const updateStmt = sqliteDb.prepare(`UPDATE 'order' SET invoice_print = 1 WHERE id = ?`);

        const transaction = sqliteDb.transaction((ids) => {
            let count = 0;
            for (const id of ids) {
                const info = updateStmt.run(id);
                count += info.changes;
            }
            return count;
        });

        // Split into chunks to keep transaction size reasonable (though SQLite handles large txns well)
        for (let i = 0; i < idsToUpdate.length; i += BATCH_SIZE) {
            const batch = idsToUpdate.slice(i, i + BATCH_SIZE);
            const changes = transaction(batch);
            totalUpdated += changes;
            process.stdout.write(`Processed ${Math.min(i + BATCH_SIZE, idsToUpdate.length)}/${idsToUpdate.length} (Updated: ${totalUpdated})\r`);
        }

        console.log(`\nSync complete. Total rows updated in SQLite: ${totalUpdated}`);

    } catch (error) {
        console.error('Sync failed:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
    }
}

if (require.main === module) {
    syncInvoicePrint();
}
