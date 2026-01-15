const pg = require('./services/postgresql.service');

async function checkAsortiCol() {
    try {
        const res = await pg.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'stoklar' AND column_name = 'is_asorti'
        `);
        console.log('is_asorti kolonu var mı?', res.length > 0);

        if (res.length > 0) {
            // Örnek bir asorti ürün bulalım
            const asorti = await pg.queryOne(`SELECT * FROM stoklar WHERE is_asorti = true LIMIT 1`);
            console.log('Örnek asorti:', asorti ? asorti.stok_kodu : 'Yok');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

checkAsortiCol();
