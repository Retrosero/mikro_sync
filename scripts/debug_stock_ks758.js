require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function debugStock() {
    try {
        console.log('Connecting to MSSQL...');
        await mssqlService.query('SELECT 1');

        const query = `
        SELECT
            S.sto_RECno AS product_id,
            S.sto_kod AS product_code,
            SHM.sth_eldeki_miktar AS stock,
            SHM.*
        FROM
            STOKLAR S WITH (NOLOCK)
        LEFT JOIN
            STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW SHM WITH (NOLOCK) ON S.sto_kod = SHM.sth_stok_kod
        WHERE S.sto_kod = 'KS-758'
        `;

        console.log('Running query for KS-758...');
        const rows = await mssqlService.query(query);

        console.log('Result count:', rows.length);
        console.log('Results:', JSON.stringify(rows, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

debugStock();
