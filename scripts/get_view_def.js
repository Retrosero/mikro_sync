require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function getViewDef() {
    try {
        const res = await mssqlService.query(`
            SELECT definition 
            FROM sys.sql_modules 
            WHERE object_id = OBJECT_ID('STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW')
        `);
        console.log('View Definition:', res[0]?.definition);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

getViewDef();
