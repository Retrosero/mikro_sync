require('dotenv').config();
const mssqlService = require('./services/mssql.service');

(async () => {
    try {
        const result = await mssqlService.query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        CHARACTER_MAXIMUM_LENGTH, 
        IS_NULLABLE,
        NUMERIC_PRECISION,
        NUMERIC_SCALE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'ODEME_EMIRLERI' 
      ORDER BY ORDINAL_POSITION
    `);

        console.log(JSON.stringify(result, null, 2));

        await mssqlService.disconnect();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
