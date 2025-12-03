require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkCariHareketCount() {
    try {
        // Toplam kayıt sayısı
        const count = await pgService.query('SELECT COUNT(*) as count FROM cari_hesap_hareketleri');
        console.log(`Toplam cari_hesap_hareketleri: ${count[0].count}`);

        // Cari ID null olanlar
        const nullCari = await pgService.query('SELECT COUNT(*) as count FROM cari_hesap_hareketleri WHERE cari_hesap_id IS NULL');
        console.log(`cari_hesap_id NULL olan: ${nullCari[0].count}`);

        // Cari ID dolu olanlar
        const withCari = await pgService.query('SELECT COUNT(*) as count FROM cari_hesap_hareketleri WHERE cari_hesap_id IS NOT NULL');
        console.log(`cari_hesap_id dolu olan: ${withCari[0].count}`);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkCariHareketCount();
