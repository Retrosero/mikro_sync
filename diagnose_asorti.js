require('dotenv').config();
const pg = require('./services/postgresql.service');

async function diagnose() {
    try {
        console.log('--- DIAGNOSING ASORTI SYNC ---');

        // 1. Check a variant that exists in stoklar
        const variant = await pg.queryOne('SELECT stok_kodu, stok_adi, eldeki_miktar, ana_stok_id FROM stoklar WHERE ana_stok_id IS NOT NULL LIMIT 1');
        console.log('Sample Variant in stoklar:', variant);

        if (variant) {
            // 2. Check if this variant exists in entegra_product
            const entegraProd = await pg.queryOne('SELECT id, "productCode", "productName" FROM entegra_product WHERE "productCode" = $1', [variant.stok_kodu]);
            console.log('Corresponding row in entegra_product:', entegraProd);

            if (entegraProd) {
                // 3. Check quantity in entegra_product_quantity
                const entegraQuant = await pg.queryOne('SELECT quantity FROM entegra_product_quantity WHERE product_id = $1', [entegraProd.id]);
                console.log('Quantity in entegra_product_quantity:', entegraQuant);

                if (entegraQuant && entegraQuant.quantity !== variant.eldeki_miktar) {
                    console.log(`MISMATCH: Web (${variant.eldeki_miktar}) vs Entegra (${entegraQuant.quantity})`);
                }
            }
        }

        // 4. Check how many variants are missing Entegra data
        const missing = await pg.query('SELECT COUNT(*) FROM stoklar s LEFT JOIN entegra_product ep ON s.stok_kodu = ep."productCode" WHERE s.ana_stok_id IS NOT NULL AND ep.id IS NULL');
        console.log('Variants without Entegra mapping:', missing[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}
diagnose();
