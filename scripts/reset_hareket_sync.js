require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function resetHareketSync() {
    try {
        console.log('Hareket tabloları için sync state temizleniyor...');
        await pgService.query("DELETE FROM sync_state WHERE tablo_adi IN ('STOK_HAREKETLERI', 'CARI_HESAP_HAREKETLERI')");
        console.log('✓ Sync state temizlendi.');
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
    }
}

resetHareketSync();
