require('dotenv').config();
const fs = require('fs');
const mssqlService = require('../services/mssql.service');

async function getViewDef() {
    try {
        const res = await mssqlService.query(`
            SELECT definition 
            FROM sys.sql_modules 
            WHERE object_id = OBJECT_ID('STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW')
        `);
        fs.writeFileSync('../view_def.txt', res[0]?.definition || 'no definition found');
        console.log('Done');
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

getViewDef();
