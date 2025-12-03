require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkCariHareketColumns() {
    try {
        console.log('Checking cari_hesap_hareketleri columns...');
        const columns = await pgService.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'cari_hesap_hareketleri'
            ORDER BY ordinal_position
        `);

        console.log('\nCurrent columns:');
        columns.forEach(c => {
            console.log(`  ${c.column_name} (${c.data_type}) ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        const hasKasaHizkod = columns.some(c => c.column_name === 'kasa_hizkod');
        console.log(`\nkasa_hizkod exists: ${hasKasaHizkod ? 'YES' : 'NO'}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkCariHareketColumns();
