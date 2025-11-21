const pgService = require('../services/postgresql.service');

async function checkCariId() {
    try {
        const result = await pgService.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'cari_hesaplar' AND column_name = 'id'
    `);

        console.log('cari_hesaplar id type:');
        result.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkCariId();
