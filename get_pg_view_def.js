require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function getViewDef() {
    try {
        const res = await pgService.query(`
            SELECT view_definition 
            FROM information_schema.views 
            WHERE table_name = 'v_stok_asortiler'
        `);
        console.log('View Definition for v_stok_asortiler:');
        console.log(res[0]?.view_definition || 'no definition found');
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

getViewDef();
