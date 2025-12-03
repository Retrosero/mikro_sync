require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function resetSyncState() {
    try {
        console.log('Sync state sifirlaniyor...\n');

        // Tüm sync_state kayıtlarını sil
        await pgService.query('DELETE FROM sync_state');
        console.log('Tum sync_state kayitlari silindi.');

        // Tabloları da temizle (opsiyonel - tam senkronizasyon için)
        console.log('\nTabloları temizliyor...');

        await pgService.query('TRUNCATE TABLE stok_hareketleri CASCADE');
        console.log('  stok_hareketleri temizlendi');

        await pgService.query('TRUNCATE TABLE cari_hesap_hareketleri CASCADE');
        console.log('  cari_hesap_hareketleri temizlendi');

        console.log('\nHazir! Simdi tam senkronizasyon baslatilacak.');

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

resetSyncState();
