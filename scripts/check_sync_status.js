const syncStateService = require('../services/sync-state.service');
const pgService = require('../services/postgresql.service');

async function checkSyncStatus() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  📊 SENKRONIZASYON DURUMU');
    console.log('═══════════════════════════════════════════════════════\n');

    try {
        // Tüm sync state kayıtlarını al
        const states = await syncStateService.getAllSyncStates();

        if (states.length === 0) {
            console.log('⚠️  Henüz hiç senkronizasyon yapılmamış!');
            console.log('   Başlamak için: node scripts/initialize_sync_state.js\n');
            return;
        }

        console.log('📅 Son Senkronizasyon Zamanları:\n');

        for (const state of states) {
            const status = state.basarili ? '✅' : '❌';
            const time = state.son_senkronizasyon_zamani
                ? new Date(state.son_senkronizasyon_zamani).toLocaleString('tr-TR')
                : 'Henüz yapılmadı';

            console.log(`${status} ${state.tablo_adi}`);
            console.log(`   Yön: ${state.yon}`);
            console.log(`   Son Sync: ${time}`);
            console.log(`   Kayıt Sayısı: ${state.kayit_sayisi}`);

            if (state.hata_mesaji) {
                console.log(`   ⚠️  Hata: ${state.hata_mesaji}`);
            }
            console.log('');
        }

        // Özet istatistikler
        console.log('═══════════════════════════════════════════════════════');
        console.log('📊 ÖZET İSTATİSTİKLER');
        console.log('═══════════════════════════════════════════════════════\n');

        const stokCount = await pgService.queryOne('SELECT COUNT(*) as count FROM stoklar');
        const barkodCount = await pgService.queryOne('SELECT COUNT(*) as count FROM urun_barkodlari');
        const fiyatCount = await pgService.queryOne('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');

        console.log(`📦 Toplam Stok        : ${stokCount.count}`);
        console.log(`🏷️  Toplam Barkod      : ${barkodCount.count}`);
        console.log(`💰 Toplam Fiyat       : ${fiyatCount.count}`);

        // Mapping durumu
        const stokMapCount = await pgService.queryOne('SELECT COUNT(*) as count FROM int_kodmap_stok');
        const fiyatMapCount = await pgService.queryOne('SELECT COUNT(*) as count FROM int_kodmap_fiyat_liste');

        console.log(`\n🔗 Stok Mapping       : ${stokMapCount.count}`);
        console.log(`🔗 Fiyat Mapping      : ${fiyatMapCount.count}`);

        if (fiyatMapCount.count === 0) {
            console.log('\n⚠️  UYARI: Fiyat mapping bulunamadı!');
            console.log('   Çözüm: node scripts/setup_price_mappings.js\n');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkSyncStatus();
