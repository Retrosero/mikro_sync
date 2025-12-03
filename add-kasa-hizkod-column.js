require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function addKasaHizkodColumn() {
    try {
        console.log('Adding kasa_hizkod column to cari_hesap_hareketleri...');

        // Check if column exists
        const check = await pgService.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cari_hesap_hareketleri' 
            AND column_name = 'kasa_hizkod'
        `);

        if (check.length > 0) {
            console.log('Column already exists!');
            return;
        }

        // Add column
        await pgService.query(`
            ALTER TABLE cari_hesap_hareketleri 
            ADD COLUMN kasa_hizkod VARCHAR(25)
        `);

        console.log('Column added successfully!');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

addKasaHizkodColumn();
