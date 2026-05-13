const pgService = require('../services/postgresql.service');

async function checkSample() {
    try {
        console.log("Sample from entegra_pictures:");
        const entegraSample = await pgService.query(`
            SELECT product_id, supplier_code, url, sort_order 
            FROM entegra_pictures 
            LIMIT 5
        `);
        console.table(entegraSample);

        console.log("\nSample from stoklar:");
        const stoklarSample = await pgService.query(`
            SELECT stok_kodu, resim_url, resim_url_2 
            FROM stoklar 
            WHERE resim_url IS NOT NULL
            LIMIT 5
        `);
        console.table(stoklarSample);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkSample();
