require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function addBankaKoduColumn() {
    try {
        console.log('banka_kodu kolonu ekleniyor...\n');

        // Kolon var mı kontrol et
        const check = await pgService.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cari_hesap_hareketleri' 
            AND column_name = 'banka_kodu'
        `);

        if (check.length > 0) {
            console.log('Kolon zaten mevcut!');
        } else {
            // Kolon ekle
            await pgService.query(`
                ALTER TABLE cari_hesap_hareketleri 
                ADD COLUMN banka_kodu VARCHAR(50)
            `);
            console.log('banka_kodu kolonu eklendi!');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

addBankaKoduColumn();
