require('dotenv').config();
const pg = require('./services/postgresql.service');

(async () => {
    try {
        console.log('Test tahsilatları ve sync queue temizleniyor...');

        // Test tahsilatlarını sil
        await pg.query(`
      DELETE FROM tahsilatlar 
      WHERE tahsilat_no LIKE 'TEST-%'
    `);

        console.log('✓ Test tahsilatları temizlendi');

        // Sync queue'daki tüm tahsilat kayıtlarını temizle
        await pg.query(`
      DELETE FROM sync_queue 
      WHERE entity_type = 'tahsilat'
      AND status IN ('pending', 'failed')
    `);

        console.log('✓ Sync queue temizlendi');

        await pg.disconnect();
    } catch (err) {
        console.error('Hata:', err);
        process.exit(1);
    }
})();
