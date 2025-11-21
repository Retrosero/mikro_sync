const pgService = require('../services/postgresql.service');

async function checkConstraints() {
    try {
        const result = await pgService.query(`
      SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) as def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname IN ('cari_hesap_hareketleri', 'stok_hareketleri')
    `);

        console.log('Constraints:');
        result.forEach(row => {
            console.log(`Name: ${row.conname}, Type: ${row.contype}, Def: ${row.def}`);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkConstraints();
