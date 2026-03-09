const pgService = require('../services/postgresql.service');

async function checkConstraints() {
    try {
        const res = await pgService.query(`
      SELECT
          conname AS constraint_name,
          contype AS constraint_type,
          (SELECT a.attname FROM pg_attribute a WHERE a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid LIMIT 1) AS column_name
      FROM
          pg_constraint c
      WHERE
          c.conrelid = 'stoklar'::regclass;
    `);
        console.log('CONSTRAINTS:', res);

        const indexes = await pgService.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'stoklar';
    `);
        console.log('INDEXES:', indexes);

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        try {
            await pgService.disconnect();
        } catch { }
    }
}

checkConstraints();
