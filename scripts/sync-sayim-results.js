require('dotenv').config();
const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');

const WEB_TABLE_NAME = 'sayim_sonuclari';
const ERP_TABLE_NAME = 'SAYIM_SONUCLARI';

// MSSQL -> PostgreSQL Type Mapping
function mapSqlTypeToPg(sqlType, maxLength) {
    const type = sqlType.toLowerCase();
    if (type.includes('int')) return 'INTEGER';
    if (type.includes('float') || type.includes('real')) return 'DOUBLE PRECISION';
    if (type.includes('decimal') || type.includes('numeric') || type.includes('money')) return 'NUMERIC';
    if (type.includes('char') || type.includes('text')) {
        // if (maxLength && maxLength > 0 && maxLength < 8000) return `VARCHAR(${maxLength})`;
        return 'TEXT'; // Safe bet for sync
    }
    if (type.includes('date') || type.includes('time')) return 'TIMESTAMP';
    if (type.includes('bit')) return 'BOOLEAN';
    if (type.includes('binary') || type.includes('image')) return 'BYTEA';
    if (type.includes('uniqueidentifier')) return 'UUID';
    return 'TEXT';
}

async function syncSayimResults() {
    try {
        console.log('Connecting to databases...');
        // ensure connections
        // await mssqlService.connect(); // Assuming this method exists or query will handle it

        console.log(`Analyzing schema of ${ERP_TABLE_NAME}...`);
        const columns = await mssqlService.query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = '${ERP_TABLE_NAME}' 
            ORDER BY ORDINAL_POSITION
        `);

        if (columns.length === 0) {
            throw new Error(`Table ${ERP_TABLE_NAME} not found in ERP!`);
        }

        // 1. Generate CREATE TABLE SQL
        let createSql = `DROP TABLE IF EXISTS ${WEB_TABLE_NAME};\n`;
        createSql += `CREATE TABLE ${WEB_TABLE_NAME} (\n`;
        createSql += columns.map(col => {
            const pgType = mapSqlTypeToPg(col.DATA_TYPE, col.CHARACTER_MAXIMUM_LENGTH);
            // Quote column names to handle reserved words or weird cases
            return `  "${col.COLUMN_NAME.toLowerCase()}" ${pgType}`;
        }).join(',\n');
        createSql += '\n);';

        console.log(`Re-creating Web table ${WEB_TABLE_NAME}...`);
        // console.log(createSql);
        await pgService.query(createSql);
        console.log('Table created successfully.');

        // 2. Fetch Data
        console.log('Fetching data from ERP...');
        const data = await mssqlService.query(`SELECT * FROM ${ERP_TABLE_NAME}`);
        console.log(`Fetched ${data.length} records.`);

        if (data.length === 0) {
            console.log('No data to sync.');
            return;
        }

        // 3. Batch Insert
        console.log('Inserting into Web database...');
        const BATCH_SIZE = 1000;
        const columnNames = columns.map(c => c.COLUMN_NAME.toLowerCase()); // Web column names
        const erpColumnNames = columns.map(c => c.COLUMN_NAME); // ERP column keys

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batch = data.slice(i, i + BATCH_SIZE);

            const values = [];
            let paramIndex = 1;
            const placeHolders = [];

            for (const row of batch) {
                const rowPlaceholders = [];
                for (const col of erpColumnNames) {
                    rowPlaceholders.push(`$${paramIndex++}`);

                    let val = row[col];
                    // Handle buffer/binary if necessary, or dates
                    if (val instanceof Date) {
                        // val is fine
                    }
                    values.push(val);
                }
                placeHolders.push(`(${rowPlaceholders.join(',')})`);
            }

            const insertSql = `
                INSERT INTO ${WEB_TABLE_NAME} ("${columnNames.join('","')}")
                VALUES ${placeHolders.join(',')}
            `;

            await pgService.query(insertSql, values);
            console.log(`Inserted batch ${i} - ${i + batch.length}`);
        }

        console.log('Sync completed successfully.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

syncSayimResults();
