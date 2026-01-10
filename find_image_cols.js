const mssql = require('./services/mssql.service');

async function findImageCols() {
    try {
        await mssql.connect();
        const res = await mssql.query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE COLUMN_NAME LIKE '%RESIM%' OR COLUMN_NAME LIKE '%IMAGE%' OR COLUMN_NAME LIKE '%PATH%'
        `);
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mssql.disconnect();
    }
}

findImageCols();
