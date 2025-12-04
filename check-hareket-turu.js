require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkHareketTuru() {
    try {
        console.log('hareket_turu kontrol ediliyor...\n');

        // hareket_turu dağılımı
        const dist = await pgService.query(`
            SELECT hareket_turu, COUNT(*) as count 
            FROM cari_hesap_hareketleri 
            GROUP BY hareket_turu
        `);

        console.log('Hareket Türü Dağılımı:');
        console.table(dist);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkHareketTuru();
