const pgService = require('./services/postgresql.service');

async function syncImages() {
    try {
        console.log("Starting image synchronization from entegra_pictures to stoklar...");

        // Get all products from stoklar that have at least one empty resim_url slot
        // and have corresponding entries in entegra_pictures
        const products = await pgService.query(`
            SELECT DISTINCT s.id, s.stok_kodu, s.resim_url, s.resim_url_2, s.resim_url_3, 
                            s.resim_url_4, s.resim_url_5, s.resim_url_6, s.resim_url_7, 
                            s.resim_url_8, s.resim_url_9, s.resim_url_10,
                            p.id as entegra_id
            FROM stoklar s
            JOIN entegra_product p ON s.stok_kodu = p."productCode"
            JOIN entegra_pictures pic ON p.id = pic.product_id
            WHERE (
                s.resim_url IS NULL OR s.resim_url = '' OR
                s.resim_url_2 IS NULL OR s.resim_url_2 = '' OR
                s.resim_url_3 IS NULL OR s.resim_url_3 = '' OR
                s.resim_url_4 IS NULL OR s.resim_url_4 = '' OR
                s.resim_url_5 IS NULL OR s.resim_url_5 = '' OR
                s.resim_url_6 IS NULL OR s.resim_url_6 = '' OR
                s.resim_url_7 IS NULL OR s.resim_url_7 = '' OR
                s.resim_url_8 IS NULL OR s.resim_url_8 = '' OR
                s.resim_url_9 IS NULL OR s.resim_url_9 = '' OR
                s.resim_url_10 IS NULL OR s.resim_url_10 = ''
            )
            AND pic.url IS NOT NULL AND pic.url != ''
        `);

        console.log(`Found ${products.length} products to check for missing images.`);

        let totalUpdated = 0;

        for (const product of products) {
            // Get all pictures for this product from entegra
            const entegraPics = await pgService.query(`
                SELECT url, sort_order 
                FROM entegra_pictures 
                WHERE product_id = $1 
                AND url IS NOT NULL AND url != ''
                ORDER BY sort_order, id
            `, [product.entegra_id]);

            if (entegraPics.length === 0) continue;

            const updates = {};
            const colNames = [
                'resim_url', 'resim_url_2', 'resim_url_3', 'resim_url_4', 'resim_url_5',
                'resim_url_6', 'resim_url_7', 'resim_url_8', 'resim_url_9', 'resim_url_10'
            ];

            let hasNewUpdate = false;
            for (let i = 0; i < colNames.length; i++) {
                const col = colNames[i];
                // If current slot is empty and entegra has a picture at this index
                if ((!product[col] || product[col] === '') && entegraPics[i]) {
                    updates[col] = entegraPics[i].url;
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
        console.error("Error during image sync:", e);
    } finally {
        await pgService.disconnect();
    }
}

syncImages();
