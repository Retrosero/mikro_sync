const pgService = require('../services/postgresql.service');

async function checkNullable() {
    try {
        const result = await pgService.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns 
      WHERE table_name = 'cari_hesap_hareketleri' AND column_name IN ('onceki_bakiye', 'sonraki_bakiye')
    `);

        console.log('cari_hesap_hareketleri Nullable Check:');
        result.forEach(row => {
            console.log(`${row.column_name}: ${row.is_nullable}, Type: ${row.data_type}`);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkNullable();
