require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function debug() {
    try {
        console.log('Connected to:', process.env.PG_DATABASE);
        const res = await pgService.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log('Tables in public schema:');
        console.table(res);
    } catch (err) {
        console.error(err);
    } finally {
        await pgService.disconnect();
    }
}

debug();
