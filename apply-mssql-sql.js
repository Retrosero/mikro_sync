require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const fs = require('fs');
const path = require('path');

async function applySql() {
    try {
        const sqlPath = path.join(__dirname, 'sql', 'create_mssql_delete_tracking.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Split by GO command as mssql driver might not handle it directly if it's a single batch
        // But usually mssqlService.query expects a single statement or batch.
        // 'GO' is a tool command, not T-SQL. We need to split.
        const batches = sqlContent.split(/\nGO\r?\n/i);

        console.log(`Executing ${batches.length} batches...`);

        for (const batch of batches) {
            if (batch.trim()) {
                await mssqlService.query(batch);
                console.log('Batch executed successfully.');
            }
        }

        console.log('All SQL batches executed successfully.');
    } catch (error) {
        console.error('Error executing SQL:', error);
    } finally {
        await mssqlService.disconnect();
    }
}

applySql();
