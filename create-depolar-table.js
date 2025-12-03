require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function createDepolarTable() {
    try {
        console.log('depolar tablosu oluşturuluyor...\n');

        // Tablo var mı kontrol et
        const check = await pgService.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'depolar'
        `);

        if (check.length > 0) {
            console.log('Tablo zaten mevcut!');
        } else {
            // Tablo oluştur
            await pgService.query(`
                CREATE TABLE depolar (
                    id SERIAL PRIMARY KEY,
                    erp_recno INTEGER UNIQUE,
                    depo_no INTEGER NOT NULL,
                    depo_adi VARCHAR(100) NOT NULL,
                    olusturma_tarihi TIMESTAMP,
                    guncelleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(depo_no)
                )
            `);
            console.log('depolar tablosu oluşturuldu!');

            // Index ekle
            await pgService.query(`
                CREATE INDEX idx_depolar_depo_no ON depolar(depo_no)
            `);
            console.log('Index eklendi.');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

createDepolarTable();
