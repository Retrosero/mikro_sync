require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function checkDetails() {
    try {
        // Check PG marka_id type
        const pgResult = await pgService.query("SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'stoklar' AND column_name = 'marka_id'");
        console.log('PG marka_id type:', pgResult[0] ? pgResult[0].data_type : 'Not found');
        console.log('PG marka_id udt:', pgResult[0] ? pgResult[0].udt_name : 'Not found');

        // Check MSSQL Adet/Miktar columns
        const mssqlResult = await mssqlService.query('SELECT TOP 1 * FROM STOKLAR');
        const columns = Object.keys(mssqlResult[0]);
        const relevant = columns.filter(c => c.toLowerCase().includes('adet') || c.toLowerCase().includes('miktar'));
        console.log('MSSQL Adet/Miktar Columns:', relevant);

        await pgService.disconnect();
        await mssqlService.disconnect();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkDetails();
