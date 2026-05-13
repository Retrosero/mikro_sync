const pgService = require('../services/postgresql.service');

async function checkSchema() {
    try {
        console.log("Checking entegra_pictures columns:");
        const entegraCols = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_pictures'
        `);
        console.table(entegraCols);

        console.log("\nChecking stoklar columns:");
        const stoklarCols = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stoklar'
            AND (column_name LIKE 'resim_url%' OR column_name = 'stok_kodu' OR column_name = 'id')
        `);
        console.table(stoklarCols);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkSchema();
