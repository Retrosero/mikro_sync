const pgService = require('../services/postgresql.service');

async function analyzePotentialUpdates() {
    try {
        console.log("Analyzing potential updates...");
        
        // Get products from entegra_pictures with their URLs and sort orders
        const query = `
            WITH EntegraPics AS (
                SELECT 
                    p."productCode",
                    pic.url,
                    ROW_NUMBER() OVER (PARTITION BY pic.product_id ORDER BY pic.sort_order, pic.id) as pic_index
                FROM entegra_pictures pic
                JOIN entegra_product p ON pic.product_id = p.id
                WHERE pic.url IS NOT NULL AND pic.url != ''
            )
            SELECT 
                s.stok_kodu,
                s.resim_url,
                s.resim_url_2,
                ep.url as new_url,
                ep.pic_index
            FROM stoklar s
            JOIN EntegraPics ep ON s.stok_kodu = ep."productCode"
            WHERE (
                (ep.pic_index = 1 AND (s.resim_url IS NULL OR s.resim_url = '')) OR
                (ep.pic_index = 2 AND (s.resim_url_2 IS NULL OR s.resim_url_2 = '')) OR
                (ep.pic_index = 3 AND (s.resim_url_3 IS NULL OR s.resim_url_3 = '')) OR
                (ep.pic_index = 4 AND (s.resim_url_4 IS NULL OR s.resim_url_4 = '')) OR
                (ep.pic_index = 5 AND (s.resim_url_5 IS NULL OR s.resim_url_5 = '')) OR
                (ep.pic_index = 6 AND (s.resim_url_6 IS NULL OR s.resim_url_6 = '')) OR
                (ep.pic_index = 7 AND (s.resim_url_7 IS NULL OR s.resim_url_7 = '')) OR
                (ep.pic_index = 8 AND (s.resim_url_8 IS NULL OR s.resim_url_8 = '')) OR
                (ep.pic_index = 9 AND (s.resim_url_9 IS NULL OR s.resim_url_9 = '')) OR
                (ep.pic_index = 10 AND (s.resim_url_10 IS NULL OR s.resim_url_10 = ''))
            )
            LIMIT 20;
        `;
        
        const potentialUpdates = await pgService.query(query);
        console.log("Potential updates (first 20):");
        console.table(potentialUpdates);

        const countQuery = `
            WITH EntegraPics AS (
                SELECT 
                    p."productCode",
                    pic.url,
                    ROW_NUMBER() OVER (PARTITION BY pic.product_id ORDER BY pic.sort_order, pic.id) as pic_index
                FROM entegra_pictures pic
                JOIN entegra_product p ON pic.product_id = p.id
                WHERE pic.url IS NOT NULL AND pic.url != ''
            )
            SELECT COUNT(*) as total_updates
            FROM stoklar s
            JOIN EntegraPics ep ON s.stok_kodu = ep."productCode"
            WHERE (
                (ep.pic_index = 1 AND (s.resim_url IS NULL OR s.resim_url = '')) OR
                (ep.pic_index = 2 AND (s.resim_url_2 IS NULL OR s.resim_url_2 = '')) OR
                (ep.pic_index = 3 AND (s.resim_url_3 IS NULL OR s.resim_url_3 = '')) OR
                (ep.pic_index = 4 AND (s.resim_url_4 IS NULL OR s.resim_url_4 = '')) OR
                (ep.pic_index = 5 AND (s.resim_url_5 IS NULL OR s.resim_url_5 = '')) OR
                (ep.pic_index = 6 AND (s.resim_url_6 IS NULL OR s.resim_url_6 = '')) OR
                (ep.pic_index = 7 AND (s.resim_url_7 IS NULL OR s.resim_url_7 = '')) OR
                (ep.pic_index = 8 AND (s.resim_url_8 IS NULL OR s.resim_url_8 = '')) OR
                (ep.pic_index = 9 AND (s.resim_url_9 IS NULL OR s.resim_url_9 = '')) OR
                (ep.pic_index = 10 AND (s.resim_url_10 IS NULL OR s.resim_url_10 = ''))
            );
        `;
        const countRes = await pgService.query(countQuery);
        console.log("Total potential updates:", countRes[0].total_updates);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

analyzePotentialUpdates();
