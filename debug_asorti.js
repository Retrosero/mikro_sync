require('dotenv').config();
const pg = require('./services/postgresql.service');
const fs = require('fs');

async function debugAsorti() {
    try {
        console.log('--- ASORTI DEBUG ---');

        // 1. Find all parent products that have variants
        const query = `
            SELECT 
                p.stok_kodu as ana_stok_kodu,
                p.stok_adi as ana_stok_adi,
                p.eldeki_miktar as ana_stok_miktar,
                p.is_asorti as ana_is_asorti,
                v.stok_kodu as asorti_kodu,
                v.stok_adi as asorti_adi,
                v.eldeki_miktar as asorti_miktar,
                v.is_asorti as asorti_is_asorti
            FROM stoklar p
            JOIN stoklar v ON p.id = v.ana_stok_id
            WHERE p.eldeki_miktar = 0 AND v.eldeki_miktar > 0
            ORDER BY p.stok_kodu;
        `;

        const results = await pg.query(query);
        console.log(`Found ${results.length} parent-variant pairs with parent=0 and variant>0`);

        if (results.length > 0) {
            let md = '# Asorti Stok Tutarsızlık Raporu\n\n';
            md += '| Ana Stok Kodu | Ana Stok Miktarı | Asorti Kodu | Asorti Miktarı |\n';
            md += '|---------------|------------------|-------------|----------------|\n';
            results.forEach(r => {
                md += `| ${r.ana_stok_kodu} | ${r.ana_stok_miktar} | ${r.asorti_kodu} | ${r.asorti_miktar} |\n`;
            });
            fs.writeFileSync('DEBUG_ASORTI.md', md);
            console.log('Report saved to DEBUG_ASORTI.md');
        } else {
            console.log('No such pairs found in stoklar table.');
        }

        // 2. Check Entegra data for these parents
        console.log('\nChecking Entegra (entegra_product_quantity) for potentially un-synced stocks...');
        const query2 = `
            SELECT 
                s.stok_kodu,
                s.eldeki_miktar as web_miktar,
                eq.quantity as entegra_miktar,
                s.ana_stok_id
            FROM stoklar s
            JOIN entegra_product ep ON s.stok_kodu = ep."productCode"
            JOIN entegra_product_quantity eq ON ep.id = eq.product_id
            WHERE s.eldeki_miktar = 0 AND eq.quantity > 0
            LIMIT 10;
        `;
        const results2 = await pg.query(query2);
        console.log('Samples of 0-stock Web products that have Entegra stock:');
        console.table(results2);

    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

debugAsorti();
