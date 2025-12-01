require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function resetKasaBankaSync() {
    try {
        console.log('Kasa ve Banka tabloları için sync state temizleniyor...');

        await pgService.query(`
            DELETE FROM sync_state 
            WHERE tablo_adi IN ('KASALAR', 'BANKALAR')
        `);

        console.log('✓ Sync state temizlendi.');
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
    }
}

resetKasaBankaSync();
