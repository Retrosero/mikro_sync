require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        const result = await pgService.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);
        console.log(result.map(row => row.table_name));
    } catch (err) {
        console.error(err);
    } finally {
        await pgService.disconnect();
    }
})();
