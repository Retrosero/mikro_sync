require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        const result = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'satis_kalemleri'
            ORDER BY column_name;
        `);
        console.log(result);
    } catch (err) {
        console.error(err);
    } finally {
        await pgService.disconnect();
    }
})();
