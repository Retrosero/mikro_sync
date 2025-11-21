const pgService = require('../services/postgresql.service');

async function addCariHesapId() {
    try {
        // First check if column exists to avoid error if we run this multiple times partially
        const check = await pgService.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'stok_hareketleri' AND column_name = 'cari_hesap_id'
    `);

        if (check.length === 0) {
            await pgService.query(`
          ALTER TABLE stok_hareketleri 
          ADD COLUMN cari_hesap_id UUID REFERENCES cari_hesaplar(id);
        `);
            console.log('stok_hareketleri: cari_hesap_id (UUID) added.');
        } else {
            console.log('stok_hareketleri: cari_hesap_id already exists.');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

addCariHesapId();
