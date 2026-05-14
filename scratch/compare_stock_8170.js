require('dotenv').config();
const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');

async function compareStock() {
    const code = '8170';
    console.log(`Comparing stock for product code: ${code}`);

    try {
        // Check MSSQL View
        console.log('--- MSSQL STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW ---');
        const mssqlRes = await mssqlService.query(`
            SELECT sth_stok_kod, sth_eldeki_miktar
            FROM STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW WITH (NOLOCK)
            WHERE sth_stok_kod = '${code}'
        `);
        console.log('MSSQL View Results:', JSON.stringify(mssqlRes, null, 2));

        // Check PG stoklar
        console.log('--- PG stoklar ---');
        const pgStoklar = await pgService.query(`
            SELECT stok_kodu, eldeki_miktar, sth_eldeki_miktar, guncelleme_tarihi
            FROM stoklar
            WHERE stok_kodu = $1
        `, [code]);
        console.log('PG stoklar Results:', JSON.stringify(pgStoklar, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

compareStock();
