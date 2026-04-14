const postgres = require('./services/postgresql.service');
const fs = require('fs');

async function main() {
    try {
        const cats = await postgres.query(`
            SELECT id, kategori_adi, path 
            FROM kategoriler 
            WHERE kategori_adi ILIKE '%deniz malzemes%' 
               OR 'Deniz Malzemesi' = ANY(path)
        `);
        
        fs.writeFileSync('kategori_deniz.json', JSON.stringify(cats, null, 2));

        const catIds = cats.map(c => c.id);
        
        // Let's check how many stoklar exist in these categories
        const stokCount = await postgres.query(`
            SELECT kategori_id, COUNT(*) as count 
            FROM stoklar 
            WHERE kategori_id = ANY($1) 
            GROUP BY kategori_id
        `, [catIds]);
        
        fs.writeFileSync('kategori_stok_count.json', JSON.stringify(stokCount, null, 2));

        // If no stok, maybe categorical relationship is missing or checking the whole universe of stoklar path
        const sampleStoklar = await postgres.query(`
            SELECT s.stok_kodu, s.stok_adi, k.kategori_adi, k.path
            FROM stoklar s
            LEFT JOIN kategoriler k ON s.kategori_id = k.id
            WHERE k.kategori_adi ILIKE '%deniz%' OR 'Deniz Malzemesi' = ANY(k.path)
            LIMIT 10
        `);
        fs.writeFileSync('deniz_stok_sample.json', JSON.stringify(sampleStoklar, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await postgres.disconnect();
    }
}
main();
