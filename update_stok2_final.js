const postgres = require('./services/postgresql.service');
const fs = require('fs');

async function main() {
    try {
        console.log('Finding categories related to Deniz Malzemesi...');
        
        const cats = await postgres.query(`
            SELECT id, kategori_adi, path 
            FROM kategoriler 
            WHERE (
                kategori_adi ILIKE '%DEN_Z MALZEMES_%' 
                OR kategori_adi ILIKE '%den_z malzemes_%'
            ) OR EXISTS (
                SELECT 1 FROM unnest(path) p 
                WHERE p ILIKE '%DEN_Z MALZEMES_%' or p ILIKE '%den_z malzemes_%'
            )
        `);
        
        const catIds = cats.map(c => c.id);
        console.log(`Found ${catIds.length} categories.`);

        if (catIds.length === 0) {
             console.log("No categories found with this search.");
             return;
        }

        const query = `
            UPDATE stoklar 
            SET stok2 = 1 
            WHERE kategori_id = ANY($1) 
            RETURNING stok_kodu, stok_adi;
        `;
        
        const updatedRows = await postgres.query(query, [catIds]);
        
        console.log(`Updated ${updatedRows.length} rows.`);

        let md = '# Deniz Malzemesi Kategorisi İçin Stok2=1 Yapılan Stoklar\n\n';
        md += `Toplam Güncellenen Kayıt: ${updatedRows.length}\n\n`;
        md += '| Stok Kodu | Stok Adı |\n|---|---|\n';
        updatedRows.forEach(row => {
            md += `| ${row.stok_kodu} | ${row.stok_adi} |\n`;
        });

        fs.writeFileSync('deniz_malzemesi_stoklar.md', md, 'utf8');
        fs.writeFileSync('update_count.txt', updatedRows.length.toString(), 'utf8');
    } catch (e) {
        console.error('Update Error:', e);
    } finally {
        await postgres.disconnect();
    }
}
main();
