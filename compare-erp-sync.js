const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function compareSync() {
    try {
        console.log('--- STOKLAR SYNC CHECK ---');
        // 1. Get last sync time from PG for STOKLAR
        const stokSync = await pgService.queryOne(
            "SELECT son_senkronizasyon_zamani FROM sync_state WHERE tablo_adi = 'STOKLAR' AND yon = 'erp_to_web'"
        );

        const lastStokSyncTime = stokSync ? stokSync.son_senkronizasyon_zamani : new Date(0);
        console.log(`Last Stok Sync Time (PG): ${lastStokSyncTime.toISOString()}`);

        const changedStokRecords = await mssqlService.query(
            "SELECT COUNT(*) as count FROM STOKLAR WHERE sto_pasif_fl = 0 AND sto_lastup_date > @lastSync",
            { lastSync: lastStokSyncTime }
        );
        console.log(`Changed STOKLAR in ERP: ${changedStokRecords[0].count}`);

        console.log('\n--- FIYATLAR SYNC CHECK ---');
        // 2. Get last sync time from PG for FIYATLAR
        const fiyatSync = await pgService.queryOne(
            "SELECT son_senkronizasyon_zamani FROM sync_state WHERE tablo_adi = 'STOK_SATIS_FIYAT_LISTELERI' AND yon = 'erp_to_web'"
        );

        const lastFiyatSyncTime = fiyatSync ? fiyatSync.son_senkronizasyon_zamani : new Date(0);
        console.log(`Last Fiyat Sync Time (PG): ${lastFiyatSyncTime.toISOString()}`);

        const changedFiyatRecords = await mssqlService.query(
            "SELECT COUNT(*) as count FROM STOK_SATIS_FIYAT_LISTELERI WHERE sfiyat_fiyati > 0 AND sfiyat_lastup_date > @lastSync",
            { lastSync: lastFiyatSyncTime }
        );
        console.log(`Changed FIYATLAR in ERP: ${changedFiyatRecords[0].count}`);

        if (changedFiyatRecords[0].count > 0) {
            const samples = await mssqlService.query(
                "SELECT TOP 5 sfiyat_stokkod, sfiyat_fiyati, sfiyat_lastup_date FROM STOK_SATIS_FIYAT_LISTELERI WHERE sfiyat_fiyati > 0 AND sfiyat_lastup_date > @lastSync ORDER BY sfiyat_lastup_date DESC",
                { lastSync: lastFiyatSyncTime }
            );
            console.log('Sample changed prices:');
            samples.forEach(s => console.log(JSON.stringify(s)));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

compareSync();
