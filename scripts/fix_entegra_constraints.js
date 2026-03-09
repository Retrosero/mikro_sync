const sqliteService = require('../services/sqlite.service');
const pgService = require('../services/postgresql.service');
const { TABLE_MAPPING } = require('./entegra-sync');

async function fixEntegraConstraints() {
    try {
        sqliteService.connect(true);
        console.log('--- Fixing Entegra Constraints ---');

        for (const [source, target] of Object.entries(TABLE_MAPPING)) {
            console.log(`Processing ${source} -> ${target}...`);

            const columns = sqliteService.getTableSchema(source);
            const pkColumn = columns.find(c => c.pk === 1);

            if (!pkColumn) {
                console.warn(`  (!) SQLite table ${source} has NO Primary Key. Skipping constraint add.`);
                continue;
            }

            const pkName = pkColumn.name;
            console.log(`  Target PK: ${pkName}`);

            // Check if PG has unique constraint or PK on this column
            const constraintCheck = await pgService.query(`
        SELECT COUNT(*) as count 
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        WHERE c.conrelid = '${target}'::regclass AND a.attname = '${pkName}';
      `);

            if (parseInt(constraintCheck[0].count) === 0) {
                console.log(`  Applying UNIQUE constraint to ${target}("${pkName}")`);
                try {
                    // Double verify no duplicates before adding PK
                    const duplicates = await pgService.query(`
            SELECT "${pkName}", COUNT(*) 
            FROM "${target}" 
            GROUP BY "${pkName}" 
            HAVING COUNT(*) > 1 
            LIMIT 5
          `);

                    if (duplicates.length > 0) {
                        console.warn(`  ⚠ Found duplicates in ${target} for ${pkName}. Cleaning up...`);
                        await pgService.query(`
              DELETE FROM "${target}" a 
              USING "${target}" b 
              WHERE a.ctid < b.ctid AND a."${pkName}" = b."${pkName}"
            `);
                    }

                    await pgService.query(`
            ALTER TABLE "${target}" ADD PRIMARY KEY ("${pkName}");
          `);
                    console.log(`  ✓ Added PRIMARY KEY to ${target}("${pkName}")`);
                } catch (e) {
                    console.error(`  Error adding PK to ${target}:`, e.message);
                    // Try adding UNIQUE index if PK fails
                    try {
                        await pgService.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${target}_${pkName}_uidx" ON "${target}"("${pkName}")`);
                        console.log(`  ✓ Added UNIQUE INDEX to ${target}("${pkName}")`);
                    } catch (e2) {
                        console.error(`  Error adding Unique Index to ${target}:`, e2.message);
                    }
                }
            } else {
                console.log(`  Constraint already exists.`);
            }
        }

    } catch (error) {
        console.error('Fixing failed:', error);
    } finally {
        sqliteService.disconnect();
        await pgService.disconnect();
    }
}

fixEntegraConstraints();
