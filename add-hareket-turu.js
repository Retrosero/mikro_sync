require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function addHareketTuruColumn() {
    try {
        console.log('hareket_turu kolonu ekleniyor...\n');

        // Kolon var mı kontrol et
        const check = await pgService.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cari_hesap_hareketleri' 
            AND column_name = 'hareket_turu'
        `);

        if (check.length > 0) {
            console.log('Kolon zaten mevcut!');
        } else {
            // Kolon ekle
            await pgService.query(`
                ALTER TABLE cari_hesap_hareketleri 
                ADD COLUMN hareket_turu VARCHAR(50)
            `);
            console.log('hareket_turu kolonu eklendi!');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

addHareketTuruColumn();
