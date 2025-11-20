require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function findBankaTables() {
    const tables = await mssqlService.query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME LIKE '%BANKA%'
  `);

    console.log('Banka tables:');
    tables.forEach(t => console.log('  ', t.TABLE_NAME));

    await mssqlService.disconnect();
    process.exit(0);
}

findBankaTables();
