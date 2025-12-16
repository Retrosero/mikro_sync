require('dotenv').config();
const pg = require('./services/postgresql.service');

(async () => {
    await pg.query(`UPDATE sync_queue SET status = 'pending', retry_count = 0 WHERE status = 'failed'`);
    console.log('Başarısız kayıtlar pending yapıldı');
    await pg.disconnect();
})();
