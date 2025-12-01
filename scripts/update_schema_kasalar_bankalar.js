require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function updateSchema() {
    try {
        console.log('Updating schema...');

        // Kasalar
        await pgService.query("ALTER TABLE kasalar ADD COLUMN IF NOT EXISTS kasa_kodu TEXT");
        console.log('Added kasa_kodu to kasalar');

        // Bankalar
        await pgService.query("ALTER TABLE bankalar ADD COLUMN IF NOT EXISTS ban_kod TEXT");
        console.log('Added ban_kod to bankalar');

        // Cari Hesap Hareketleri
        await pgService.query("ALTER TABLE cari_hesap_hareketleri ADD COLUMN IF NOT EXISTS cha_kasa_hizkod TEXT");
        console.log('Added cha_kasa_hizkod to cari_hesap_hareketleri');

    } catch (error) {
        console.error('Error updating schema:', error);
    } finally {
        await pgService.disconnect();
    }
}

updateSchema();
