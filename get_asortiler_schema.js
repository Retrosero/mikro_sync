require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function getAsortilerSchema() {
    try {
        const res = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'asortiler'
            ORDER BY ordinal_position
        `);
        console.log('Columns in asortiler table:');
        console.table(res);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

getAsortilerSchema();
