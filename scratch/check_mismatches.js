const pgService = require('../services/postgresql.service');

async function checkMismatches() {
    try {
        console.log("Products in stoklar without resim_url (first 10):");
        const missingPics = await pgService.query(`
            SELECT stok_kodu 
            FROM stoklar 
            WHERE resim_url IS NULL OR resim_url = ''
            LIMIT 10
        `);
        console.table(missingPics);

        if (missingPics.length > 0) {
            const codes = missingPics.map(p => p.stok_kodu);
            console.log("\nChecking these codes in entegra_product:");
            const entegraCheck = await pgService.query(`
                SELECT "productCode", id 
                FROM entegra_product 
                WHERE "productCode" = ANY($1)
            `, [codes]);
            console.table(entegraCheck);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkMismatches();
