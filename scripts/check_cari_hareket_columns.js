const pgService = require('../services/postgresql.service');

async function checkColumns() {
    try {
        const result = await pgService.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cari_hesap_hareketleri'
    `);

        console.log('cari_hesap_hareketleri Columns:');
        result.forEach(row => {
            console.log(row.column_name);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkColumns();
