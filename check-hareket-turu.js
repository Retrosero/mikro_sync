require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkHareketTuru() {
    try {
        console.log('hareket_tipi ve hareket_turu kontrol ediliyor...\n');

        // Tahsilat kayıtlarını kontrol et
        const records = await pgService.query(`
            SELECT hareket_tipi, hareket_turu, COUNT(*) as count
            FROM cari_hesap_hareketleri
            WHERE hareket_tipi LIKE 'Tahsilat%'
            GROUP BY hareket_tipi, hareket_turu
            ORDER BY hareket_tipi
        `);

        console.log('Tahsilat kayıtları:');
        console.table(records);

        // Tüm farklı hareket_turu değerleri
        const allTuru = await pgService.query(`
            SELECT DISTINCT hareket_turu, COUNT(*) as count
            FROM cari_hesap_hareketleri
            GROUP BY hareket_turu
            ORDER BY count DESC
        `);

        console.log('\nTüm hareket_turu değerleri:');
        console.table(allTuru);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkHareketTuru();
