require('dotenv').config();
const pg = require('./services/postgresql.service');
const fs = require('fs');

async function generateReport() {
    try {
        console.log('Searching for parents with 0 stock that have variants with Entegra stock...');

        // Query: Parent has 0 stock in Web, but at least one child has non-zero stock in Entegra (SQLite table)
        const query = `
            SELECT 
                p.stok_kodu as ana_stok_kodu,
                p.stok_adi as ana_stok_adi,
                p.eldeki_miktar as web_ana_stok_miktar,
                v.stok_kodu as varyant_kodu,
                eq.quantity as entegra_varyant_miktar
            FROM stoklar p
            JOIN stoklar v ON p.id = v.ana_stok_id
            JOIN entegra_product ep ON v.stok_kodu = ep."productCode"
            JOIN entegra_product_quantity eq ON ep.id = eq.product_id
            WHERE p.eldeki_miktar = 0 AND eq.quantity > 0
            ORDER BY p.stok_kodu, v.stok_kodu;
        `;

        const results = await pg.query(query);
        console.log(`Found ${results.length} discrepancies.`);

        let mdContent = '# Ana Stoğu 0 olup Entegra (Asorti) Stoğu Olan Ürünler\n\n';
        mdContent += `Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}\n\n`;
        mdContent += '| Ana Stok Kodu | Ana Stok Adı | Varyant Kodu | Entegra Stoğu |\n';
        mdContent += '|---------------|--------------|--------------|---------------|\n';

        results.forEach(row => {
            mdContent += `| ${row.ana_stok_kodu} | ${row.ana_stok_adi} | ${row.varyant_kodu} | ${row.entegra_varyant_miktar} |\n`;
        });

        if (results.length === 0) {
            mdContent += '| - | Veri bulunamadı | - | - |\n';
        }

        fs.writeFileSync('ASORTI_STOK_DISCREPANCY.md', mdContent);
        console.log('Report saved: ASORTI_STOK_DISCREPANCY.md');

    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

generateReport();
