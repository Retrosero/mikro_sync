require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkFailedSales() {
    try {
        console.log('Başarısız Satışlar Kontrol Ediliyor...');
        console.log('='.repeat(70));

        // Başarısız kayıtları al
        const failed = await pgService.query(`
      SELECT sq.*, s.satis_tarihi, s.cari_hesap_id, s.toplam_tutar
      FROM sync_queue sq
      LEFT JOIN satislar s ON s.id = sq.entity_id
      WHERE sq.status = 'failed' AND sq.entity_type = 'satis'
      ORDER BY sq.created_at DESC
    `);

        console.log(`${failed.length} başarısız satış bulundu\n`);

        for (const record of failed) {
            console.log(`Satış ID: ${record.entity_id}`);
            console.log(`  Tarih: ${record.satis_tarihi}`);
            console.log(`  Cari ID: ${record.cari_hesap_id}`);
            console.log(`  Tutar: ${record.toplam_tutar}`);
            console.log(`  Hata: ${record.error_message}`);
            console.log(`  Retry: ${record.retry_count}/3`);
            console.log('');
        }

        console.log('='.repeat(70));

    } catch (error) {
        console.error('✗ Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkFailedSales();
