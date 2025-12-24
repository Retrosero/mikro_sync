const pgService = require('../services/postgresql.service');

async function migrate() {
    try {
        console.log('Checking if sth_isemri_gider_kodu exists in stok_hareketleri...');
        const res = await pgService.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'stok_hareketleri' AND column_name = 'sth_isemri_gider_kodu'");

        if (res.length === 0) {
            console.log('Column does not exist. Adding sth_isemri_gider_kodu...');
            await pgService.query("ALTER TABLE stok_hareketleri ADD COLUMN sth_isemri_gider_kodu VARCHAR(255)");
            console.log('Column added successfully.');
        } else {
            console.log('Column already exists.');
        }
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pgService.disconnect();
    }
}

migrate();
