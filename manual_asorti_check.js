require('dotenv').config();
const pg = require('./services/postgresql.service');
const fs = require('fs');

async function findDiscrepancies() {
    try {
        console.log('Searching for products with dashed codes whose prefix has 0 stock...');
        
        const allProducts = await pg.query('SELECT stok_kodu, eldeki_miktar FROM stoklar');
        const stockMap = new Map();
        allProducts.forEach(p => stockMap.set(p.stok_kodu, p.eldeki_miktar));

        const discrepancies = [];

        for (const p of allProducts) {
            if (p.stok_kodu.includes('-')) {
                const parts = p.stok_kodu.split('-');
                const prefix = parts[0];
                
                if (stockMap.has(prefix)) {
                    const prefixStock = stockMap.get(prefix);
                    if (prefixStock === 0 && p.eldeki_miktar > 0) {
                        discrepancies.push({
                            prefix: prefix,
                            prefixStock: prefixStock,
                            variant: p.stok_kodu,
                            variantStock: p.eldeki_miktar
                        });
                    }
                }
            }
        }

        console.log(`Found ${discrepancies.length} manual dash-based discrepancies.`);
        
        let md = '# Manuel Asorti-Dash Analiz Raporu\n\n';
        md += '| Ana Kod (Önek) | Ana Stok Miktarı | Varyant Kod | Varyant Stok |\n';
        md += '|----------------|------------------|-------------|--------------|\n';
        discrepancies.forEach(d => {
            md += `| ${d.prefix} | ${d.prefixStock} | ${d.variant} | ${d.variantStock} |\n`;
        });
        fs.writeFileSync('MANUAL_ASORTI_DISCREPANCY.md', md);

    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

findDiscrepancies();
