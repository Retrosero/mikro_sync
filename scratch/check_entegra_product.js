const pgService = require('../services/postgresql.service');

async function checkEntegraProduct() {
    try {
        const cols = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_product'
        `);
        console.table(cols);

        const sample = await pgService.query(`
            SELECT id, model, product_id 
            FROM entegra_product 
            LIMIT 5
        `);
        console.table(sample);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkEntegraProduct();
