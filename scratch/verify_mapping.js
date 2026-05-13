const pgService = require('../services/postgresql.service');

async function verifyMapping() {
    try {
        console.log("Checking if entegra_product.id matches entegra_pictures.product_id:");
        const joinCheck = await pgService.query(`
            SELECT p.id, p."productCode", pic.url 
            FROM entegra_product p
            JOIN entegra_pictures pic ON p.id = pic.product_id
            LIMIT 5
        `);
        console.table(joinCheck);

        if (joinCheck.length > 0) {
            const productCode = joinCheck[0].productCode;
            console.log(`\nChecking if productCode '${productCode}' exists in stoklar:`);
            const stoklarCheck = await pgService.query(`
                SELECT stok_kodu, resim_url 
                FROM stoklar 
                WHERE stok_kodu = $1
            `, [productCode]);
            console.table(stoklarCheck);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

verifyMapping();
