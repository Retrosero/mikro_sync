const pgService = require('../services/postgresql.service');

async function checkPictures() {
    try {
        const codes = ['21080', '24026', '16763', '36013', '222-3'];
        console.log(`Checking pictures for codes: ${codes.join(', ')}`);
        
        const res = await pgService.query(`
            SELECT p."productCode", pic.url, pic.sort_order 
            FROM entegra_pictures pic
            JOIN entegra_product p ON pic.product_id = p.id
            WHERE p."productCode" = ANY($1)
            ORDER BY p."productCode", pic.sort_order
        `, [codes]);
        console.table(res);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkPictures();
