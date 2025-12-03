require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkCariHareketData() {
    try {
        console.log('cari_hesap_hareketleri tablosu kontrol ediliyor...\n');

        // Toplam kayıt sayısı
        const count = await pgService.query('SELECT COUNT(*) as count FROM cari_hesap_hareketleri');
        console.log(`Toplam kayıt: ${count[0].count}`);

        if (count[0].count > 0) {
            // İlk 5 kayıt
            const sample = await pgService.query('SELECT * FROM cari_hesap_hareketleri LIMIT 5');
            console.log('\nÖrnek kayıtlar:');
            console.table(sample);

            // Cari ID null olanlar
            const nullCari = await pgService.query('SELECT COUNT(*) as count FROM cari_hesap_hareketleri WHERE cari_hesap_id IS NULL');
            console.log(`\ncari_hesap_id NULL olan: ${nullCari[0].count}`);
        } else {
            console.log('Tablo boş!');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkCariHareketData();
