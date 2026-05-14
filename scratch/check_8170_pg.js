require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkPG() {
    const code = '8170';
    try {
        console.log('--- PG stoklar ---');
        const pgStoklar = await pgService.query(`
            SELECT stok_kodu, stok_adi, guncelleme_tarihi
            FROM stoklar
            WHERE stok_kodu = $1 OR stok_kodu LIKE $2
        `, [code, `%${code}%`]);
        console.log('PG stoklar:', JSON.stringify(pgStoklar, null, 2));

        console.log('--- PG xmlurunler ---');
        const pgXml = await pgService.query(`
            SELECT product_code, stock, updated_at
            FROM xmlurunler
            WHERE product_code = $1 OR product_code LIKE $2
        `, [code, `%${code}%`]);
        console.log('PG xmlurunler:', JSON.stringify(pgXml, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkPG();
