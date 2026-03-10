const pgService = require('./services/postgresql.service');

async function checkSyncState() {
    try {
        const states = await pgService.query('SELECT tablo_adi, yon, son_senkronizasyon_zamani, kayit_sayisi, basarili, guncelleme_tarihi FROM sync_state ORDER BY guncelleme_tarihi DESC');
        console.log('--- Sync State Table ---');
        states.forEach(state => {
            console.log(JSON.stringify(state));
        });

        const stokCount = await pgService.query('SELECT COUNT(*) as count FROM stoklar');
        console.log(`Web Stoklar Count: ${stokCount[0].count}`);

        const mappingCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_stok');
        console.log(`Mapping Count: ${mappingCount[0].count}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSyncState();
