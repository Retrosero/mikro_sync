const pgService = require('../services/postgresql.service');

async function checkEntegraProductCols() {
    try {
        const cols = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_product'
            ORDER BY ordinal_position
            LIMIT 50
        `);
        console.table(cols);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkEntegraProductCols();
