require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('Hatalı kayıtlar tekrar kuyruğa alınıyor...');

        // Failed olanları pending yap ve retry_count sıfırla
        const result = await pgService.query(`
            UPDATE sync_queue 
            SET status = 'pending', 
                retry_count = 0, 
                error_message = NULL,
                processed_at = NULL
            WHERE status = 'failed'
        `);

        // Etkilenen satır sayısını PostgreSQL'in döndürdüğü 'rowCount' üzerinden alabiliriz ama pgService output formatına göre değişebilir.
        // Genellikle pg kütüphanesi result.rowCount döndürür.

        console.log('İşlem tamamlandı.');
        // Kontrol et
        const stats = await pgService.query(`
             SELECT status, count(*) as count FROM sync_queue GROUP BY status
        `);
        console.log('Güncel Durum:', stats);

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        await pgService.disconnect();
    }
})();
