require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function debugData() {
    try {
        console.log('DEBUG START');

        // Check BANKALAR data
        console.log('\nChecking BANKALAR data...');
        const banks = await mssqlService.query('SELECT TOP 5 * FROM BANKALAR');
        console.log('First 5 banks:', JSON.stringify(banks, null, 2));

        // Check Cari count
        const cariCount = await pgService.query('SELECT COUNT(*) as count FROM cari_hesaplar');
        console.log('\nCari count in PG:', cariCount[0].count);

        // Check Cari Mappings count
        const mapCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_cari');
        console.log('Cari Mapping count:', mapCount[0].count);

        await pgService.disconnect();
        await mssqlService.disconnect();

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugData();
