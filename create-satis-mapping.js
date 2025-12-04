require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function createSatisMapping() {
    try {
        console.log('int_satis_mapping tablosu oluşturuluyor...\n');

        await pgService.query(`
            CREATE TABLE IF NOT EXISTS int_satis_mapping (
                web_satis_id UUID PRIMARY KEY,
                erp_evrak_seri VARCHAR(10),
                erp_evrak_no INTEGER,
                aktarim_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(erp_evrak_seri, erp_evrak_no)
            )
        `);

        console.log('✓ Tablo oluşturuldu!');

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

createSatisMapping();
