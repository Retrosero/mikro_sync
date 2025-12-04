require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function addErpColumns() {
    try {
        console.log('satislar tablosuna ERP kolonları ekleniyor...\n');

        // Kolonları ekle
        await pgService.query(`
            ALTER TABLE satislar 
            ADD COLUMN IF NOT EXISTS erp_aktarildi BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS erp_evrak_seri VARCHAR(10),
            ADD COLUMN IF NOT EXISTS erp_evrak_no INTEGER,
            ADD COLUMN IF NOT EXISTS erp_aktarim_tarihi TIMESTAMP
        `);

        console.log('✓ Kolonlar eklendi!');

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

addErpColumns();
