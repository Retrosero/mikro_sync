require('dotenv').config();
const pg = require('./services/postgresql.service');

async function checkStok() {
    try {
        const result = await pg.query(`
            SELECT stok_kodu, stok_adi, olcu, raf_kodu, ambalaj, birim_turu
            FROM stoklar 
            WHERE stok_kodu = '3624-KAMYON'
        `);
        console.log('Stok Bilgileri:');
        for (const row of result) {
            console.log(`stok_kodu: ${row.stok_kodu}`);
            console.log(`stok_adi (${row.stok_adi ? row.stok_adi.length : 0} karakter): ${row.stok_adi}`);
            console.log(`olcu: ${row.olcu}`);
            console.log(`raf_kodu: ${row.raf_kodu}`);
            console.log(`ambalaj: ${row.ambalaj}`);
            console.log(`birim_turu: ${row.birim_turu}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

checkStok();
