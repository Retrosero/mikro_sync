require('dotenv').config();
const pg = require('./services/postgresql.service');

(async () => {
    const result = await pg.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'tahsilatlar' 
    ORDER BY ordinal_position
  `);

    console.log('Tahsilatlar tablosu sütunları:');
    console.log(result.map(r => r.column_name).join(', '));

    await pg.disconnect();
})();
