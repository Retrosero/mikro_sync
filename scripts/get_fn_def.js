require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function getFuncDef() {
    try {
        const res = await mssqlService.query(`SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('fn_EldekiMiktar')`);
        console.log('Function Definition:', res[0]?.definition);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

getFuncDef();
