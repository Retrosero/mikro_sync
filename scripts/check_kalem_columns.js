const pgService = require('../services/postgresql.service');

async function checkColumns() {
    try {
        const columns = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'satis_kalemleri' 
            AND (column_name LIKE '%indirim%' OR column_name LIKE '%iskonto%')
            ORDER BY column_name
        `);

        console.log('satis_kalemleri tablosundaki indirim/iskonto sütunları:');
        columns.forEach(c => {
            console.log(`  - ${c.column_name} (${c.data_type})`);
        });

        // Tüm sütunları göster
        const allColumns = await pgService.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'satis_kalemleri'
            ORDER BY ordinal_position
        `);

        console.log('\nTüm sütunlar:');
        allColumns.forEach(c => console.log(`  - ${c.column_name}`));

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkColumns();
