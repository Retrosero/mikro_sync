const pgService = require('./services/postgresql.service');

async function syncImagesOptimized() {
    try {
        console.log("Starting optimized image synchronization...");

        // 1. Get all relevant pictures and group them by productCode
        console.log("Fetching all Entegra pictures...");
        const allPics = await pgService.query(`
            SELECT TRIM(p."productCode") as "productCode", pic.url, pic.sort_order, pic.product_id
            FROM entegra_pictures pic
            JOIN entegra_product p ON pic.product_id = p.id
            WHERE pic.url IS NOT NULL AND pic.url != ''
            ORDER BY TRIM(p."productCode"), pic.sort_order, pic.id
        `);

        const picMap = new Map();
        for (const pic of allPics) {
            const code = pic.productCode;
            if (!picMap.has(code)) {
                picMap.set(code, []);
            }
            picMap.get(code).push(pic.url);
        }
        console.log(`Loaded pictures for ${picMap.size} products.`);

        // 2. Get all products from stoklar
        console.log("Fetching products from stoklar...");
        const products = await pgService.query(`
            SELECT id, TRIM(stok_kodu) as stok_kodu, resim_url, resim_url_2, resim_url_3, 
                   resim_url_4, resim_url_5, resim_url_6, resim_url_7, 
                   resim_url_8, resim_url_9, resim_url_10
            FROM stoklar
        `);

        console.log(`Checking ${products.length} products for missing images...`);

        let totalUpdated = 0;
        const colNames = [
            'resim_url', 'resim_url_2', 'resim_url_3', 'resim_url_4', 'resim_url_5',
            'resim_url_6', 'resim_url_7', 'resim_url_8', 'resim_url_9', 'resim_url_10'
        ];

        for (const product of products) {
            const entegraUrls = picMap.get(product.stok_kodu);
            if (!entegraUrls) continue;

            const updates = {};
            let hasNewUpdate = false;

            for (let i = 0; i < colNames.length; i++) {
                const col = colNames[i];
                // If current slot is empty and entegra has a picture at this index
                if ((!product[col] || product[col] === '') && entegraUrls[i]) {
                    updates[col] = entegraUrls[i];
                    hasNewUpdate = true;
                }
            }

            if (hasNewUpdate) {
                const setClause = Object.keys(updates).map((col, idx) => `"${col}" = $${idx + 2}`).join(', ');
                const values = [product.id, ...Object.values(updates)];
                
                await pgService.query(`
                    UPDATE stoklar 
                    SET ${setClause} 
                    WHERE id = $1
                `, values);
                
                totalUpdated++;
                if (totalUpdated % 100 === 0) {
                    console.log(`Updated ${totalUpdated} products...`);
                }
            }
        }

        console.log(`Successfully completed. Total products updated: ${totalUpdated}`);

    } catch (e) {
        console.error("Error during optimized image sync:", e);
    } finally {
        await pgService.disconnect();
    }
}

syncImagesOptimized();
