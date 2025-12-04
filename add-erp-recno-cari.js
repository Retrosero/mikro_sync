require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function addErpRecnoColumn() {
    try {
        console.log('cari_hesap_hareketleri tablosuna erp_recno kolonu ekleniyor...\n');

        // Kolon var mı kontrol et
        const check = await pgService.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cari_hesap_hareketleri' 
            AND column_name = 'erp_recno'
        `);

        if (check.length > 0) {
            console.log('Kolon zaten mevcut!');
        } else {
            // Kolon ekle
            await pgService.query(`
                ALTER TABLE cari_hesap_hareketleri 
                ADD COLUMN erp_recno BIGINT
            `);
            console.log('✓ erp_recno kolonu eklendi!');

            // Index ekle (performans için)
            await pgService.query(`
                CREATE INDEX IF NOT EXISTS idx_cari_hesap_hareketleri_erp_recno 
                ON cari_hesap_hareketleri(erp_recno)
            `);
            console.log('✓ Index oluşturuldu!');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

addErpRecnoColumn();
