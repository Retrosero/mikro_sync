require('dotenv').config();
const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');

async function check8170() {
    const code = '8170';
    console.log(`Checking product code: ${code}`);

    try {
        // Check MSSQL
        console.log('--- MSSQL STOKLAR ---');
        const mssqlRes = await mssqlService.query(`
            SELECT sto_kod, sto_isim, sto_RECno, sto_create_date, sto_lastup_date
            FROM STOKLAR WITH (NOLOCK)
            WHERE sto_kod = '${code}' OR sto_kod LIKE '%${code}%'
        `);
        console.log('MSSQL Results:', JSON.stringify(mssqlRes, null, 2));

        // Check PG stoklar
        console.log('--- PG stoklar ---');
        try {
            const pgStoklar = await pgService.query(`
                SELECT stok_kodu, stok_adi, olusturma_tarihi, guncelleme_tarihi
                FROM stoklar
                WHERE stok_kodu = $1 OR stok_kodu LIKE $2
            `, [code, `%${code}%`]);
            console.log('PG stoklar Results:', JSON.stringify(pgStoklar, null, 2));
        } catch (e) {
            console.error('PG stoklar error:', e.message);
        }

        // Check PG xmlurunler
        console.log('--- PG xmlurunler ---');
        try {
            const pgXml = await pgService.query(`
                SELECT product_code, stock, updated_at
                FROM xmlurunler
                WHERE product_code = $1 OR product_code LIKE $2
            `, [code, `%${code}%`]);
            console.log('PG xmlurunler Results:', JSON.stringify(pgXml, null, 2));
        } catch (e) {
            console.error('PG xmlurunler error:', e.message);
        }

        // Check PG entegra_product
        console.log('--- PG entegra_product ---');
        try {
            // Let's check columns for entegra_product first or just try productCode
            const pgEntegra = await pgService.query(`
                SELECT *
                FROM entegra_product
                WHERE "productCode" = $1 OR "productCode" LIKE $2
            `, [code, `%${code}%`]);
            console.log('PG entegra_product Results:', JSON.stringify(pgEntegra, null, 2));
        } catch (e) {
            console.error('PG entegra_product error:', e.message);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
        process.exit(0);
    }
}

check8170();
