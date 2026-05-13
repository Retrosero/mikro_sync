const pgService = require('../services/postgresql.service');

async function debugSpecificCode() {
    try {
        const code = '36013';
        console.log(`Debugging code: [${code}]`);

        const stoklar = await pgService.query(`
            SELECT id, stok_kodu, resim_url, resim_url_2 
            FROM stoklar 
            WHERE TRIM(stok_kodu) = $1
        `, [code]);
        console.log("Stoklar record:");
        console.table(stoklar);

        const entegra = await pgService.query(`
            SELECT id, "productCode" 
            FROM entegra_product 
            WHERE TRIM("productCode") = $1
        `, [code]);
        console.log("Entegra record:");
        console.table(entegra);

        if (entegra.length > 0) {
            const pics = await pgService.query(`
                SELECT url, sort_order 
                FROM entegra_pictures 
                WHERE product_id = $1
                ORDER BY sort_order, id
            `, [entegra[0].id]);
            console.log("Entegra pictures:");
            console.table(pics);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

debugSpecificCode();
