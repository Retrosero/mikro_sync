require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkConstraints() {
    try {
        const constraints = await pgService.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'xmlurunler'::regclass
        `);
        console.log('Constraints for xmlurunler:', JSON.stringify(constraints, null, 2));

        // Also check unique indexes
        const indexes = await pgService.query(`
            SELECT
                t.relname as table_name,
                i.relname as index_name,
                a.attname as column_name
            FROM
                pg_class t,
                pg_class i,
                pg_index ix,
                pg_attribute a
            WHERE
                t.oid = ix.indrelid
                AND i.oid = ix.indexrelid
                AND a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)
                AND t.relkind = 'r'
                AND t.relname = 'xmlurunler'
                AND ix.indisunique = true
            ORDER BY
                t.relname,
                i.relname;
        `);
        console.log('Unique Indexes for xmlurunler:', JSON.stringify(indexes, null, 2));

    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkConstraints();
