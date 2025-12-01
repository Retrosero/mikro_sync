require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkConstraints() {
    try {
        const constraints = await pgService.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'bankalar'::regclass
        `);
        console.log('Constraints:', constraints);
    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}

checkConstraints();
