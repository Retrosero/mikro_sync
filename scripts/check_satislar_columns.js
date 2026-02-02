const pgService = require('../services/postgresql.service');

async function checkSatislarColumns() {
    try {
        const columns = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'satislar' 
            AND (column_name LIKE '%iskonto%' OR column_name LIKE '%indirim%')
            ORDER BY column_name
        `);

        console.log('satislar tablosundaki iskonto/indirim sütunları:');
        columns.forEach(c => {
            console.log(`  - ${c.column_name} (${c.data_type})`);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkSatislarColumns();
