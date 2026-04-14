const postgres = require('./services/postgresql.service');
const fs = require('fs');

async function main() {
    try {
        console.log('Finding categories related to Deniz Malzemesi...');
        
        // Find categories where 'Deniz Malzemesi' is in the path OR kategori_adi is 'Deniz Malzemesi'
        const cats = await postgres.query(`
            SELECT id, kategori_adi, path 
            FROM kategoriler 
            WHERE kategori_adi ILIKE '%deniz malzemes%' 
               OR 'Deniz Malzemesi' = ANY(path)
        `);
        
        if (cats.length === 0) {
            console.log('No categories found for Deniz Malzemesi.');
            fs.writeFileSync('update_results.json', JSON.stringify({ updated: [] }));
            return;
        }

        const catIds = cats.map(c => c.id);
        console.log(`Found ${catIds.length} categories.`);

        // Now perform the update and return the affected rows
        const query = `
            UPDATE stoklar 
            SET stok2 = 1 
            WHERE kategori_id = ANY($1) 
            RETURNING stok_kodu, stok_adi;
        `;
        
        const updatedRows = await postgres.query(query, [catIds]);
        
        console.log(`Updated ${updatedRows.length} rows.`);

        // Write the result to a JSON file to be read later
        fs.writeFileSync('update_results.json', JSON.stringify({ 
            updatedCount: updatedRows.length,
            items: updatedRows
        }, null, 2));

    } catch (e) {
        console.error('Update Error:', e);
    } finally {
        await postgres.disconnect();
    }
}
main();
