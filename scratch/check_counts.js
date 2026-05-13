const pgService = require('../services/postgresql.service');

async function checkCounts() {
    try {
        const entegraProductCount = await pgService.query("SELECT COUNT(*) FROM entegra_product");
        console.log("Total products in entegra_product:", entegraProductCount[0].count);

        const entegraPicturesCount = await pgService.query("SELECT COUNT(DISTINCT product_id) FROM entegra_pictures");
        console.log("Total products with pictures in entegra_pictures:", entegraPicturesCount[0].count);

        const stoklarCount = await pgService.query("SELECT COUNT(*) FROM stoklar");
        console.log("Total products in stoklar:", stoklarCount[0].count);

        const stoklarWithPictures = await pgService.query("SELECT COUNT(*) FROM stoklar WHERE resim_url IS NOT NULL AND resim_url != ''");
        console.log("Products in stoklar with resim_url:", stoklarWithPictures[0].count);

        const stoklarWithoutPictures = await pgService.query("SELECT COUNT(*) FROM stoklar WHERE resim_url IS NULL OR resim_url = ''");
        console.log("Products in stoklar without resim_url:", stoklarWithoutPictures[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkCounts();
