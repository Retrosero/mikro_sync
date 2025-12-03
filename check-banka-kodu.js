require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkBankaKodu() {
    try {
        console.log('banka_kodu kontrol ediliyor...\n');

        // banka_kodu dolu olan kayıt sayısı
        const count = await pgService.query('SELECT COUNT(*) as count FROM cari_hesap_hareketleri WHERE banka_kodu IS NOT NULL');
        console.log(`banka_kodu dolu olan kayıt sayısı: ${count[0].count}`);

        if (count[0].count > 0) {
            // Örnek kayıtlar
            const sample = await pgService.query('SELECT id, cari_hesap_id, banka_kodu, tutar FROM cari_hesap_hareketleri WHERE banka_kodu IS NOT NULL LIMIT 5');
            console.log('\nÖrnek kayıtlar:');
            console.table(sample);
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkBankaKodu();
