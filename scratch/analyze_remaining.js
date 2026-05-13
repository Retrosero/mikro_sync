const pgService = require('../services/postgresql.service');

async function analyzeRemaining() {
    try {
        console.log("Analyzing remaining products without images...");
        const remaining = await pgService.query(`
            SELECT s.stok_kodu 
            FROM stoklar s
            WHERE s.resim_url IS NULL OR s.resim_url = ''
            LIMIT 10
        `);
        
        for (const r of remaining) {
            const code = r.stok_kodu.trim();
            const entegra = await pgService.query(`
                SELECT id FROM entegra_product WHERE TRIM("productCode") = $1
            `, [code]);
            
            if (entegra.length === 0) {
                console.log(`[${code}] NOT FOUND in entegra_product`);
            } else {
                const pics = await pgService.query(`
                    SELECT COUNT(*) as count 
                    FROM entegra_pictures 
                    WHERE product_id = $1 AND url IS NOT NULL AND url != ''
                `, [entegra[0].id]);
                console.log(`[${code}] FOUND in entegra_product. Entegra pictures count: ${pics[0].count}`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

analyzeRemaining();
