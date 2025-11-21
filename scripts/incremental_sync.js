const stokProcessor = require('../sync-jobs/stok.processor');
const fiyatProcessor = require('../sync-jobs/fiyat.processor');
const syncStateService = require('../services/sync-state.service');
const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

/**
 * İnkremental Senkronizasyon Scripti
 * Sadece değişen kayıtları senkronize eder
 */
async function incrementalSync() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  İNKREMENTAL SENKRONIZASYON');
    console.log('═══════════════════════════════════════════════════════\n');

    const startTime = new Date();
    const stats = {
        stoklar: 0,
        fiyatlar: 0
    };

    try {
        // 1. STOK SENKRONIZASYONU
        console.log('📦 STOK SENKRONIZASYONU\n');
        const stokLastSync = await syncStateService.getLastSyncTime('STOKLAR', 'erp_to_web');

        if (stokLastSync) {
            console.log(`Son senkronizasyon: ${stokLastSync.toLocaleString('tr-TR')}`);
            console.log('Sadece değişen kayıtlar aktarılacak...\n');
        } else {
            console.log('İLK SENKRONIZASYON - Tüm kayıtlar aktarılacak...\n');
        }

        stats.stoklar = await stokProcessor.syncToWeb();
        console.log(`✅ ${stats.stoklar} stok senkronize edildi\n`);

        // 2. FİYAT SENKRONIZASYONU
        console.log('💰 FİYAT SENKRONIZASYONU\n');

        // Önce fiyat mapping kontrolü
        const fiyatMappingCount = await pgService.queryOne(
            'SELECT COUNT(*) as count FROM int_kodmap_fiyat_liste'
        );

        if (fiyatMappingCount.count === 0) {
            console.log('⚠️  UYARI: Fiyat mapping bulunamadı!');
            console.log('   Fiyat senkronizasyonu atlanıyor.\n');
        } else {
            console.log(`${fiyatMappingCount.count} fiyat mapping bulundu`);

            const fiyatLastSync = await syncStateService.getLastSyncTime('STOK_SATIS_FIYAT_LISTELERI', 'erp_to_web');

            if (fiyatLastSync) {
                console.log(`Son senkronizasyon: ${fiyatLastSync.toLocaleString('tr-TR')}`);
                console.log('Sadece değişen kayıtlar aktarılacak...\n');
            } else {
                console.log('İLK SENKRONIZASYON - Tüm kayıtlar aktarılacak...\n');
            }

            stats.fiyatlar = await fiyatProcessor.syncToWeb();
            console.log(`✅ ${stats.fiyatlar} fiyat senkronize edildi\n`);
        }

        // 3. ÖZET RAPOR
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);

        console.log('═══════════════════════════════════════════════════════');
        console.log('  SENKRONIZASYON TAMAMLANDI');
        console.log('═══════════════════════════════════════════════════════\n');
        console.log(`📊 Sonuçlar:`);
        console.log(`   Stok       : ${stats.stoklar} kayıt`);
        console.log(`   Fiyat      : ${stats.fiyatlar} kayıt`);
        console.log(`   Süre       : ${duration} saniye\n`);

        // Son senkronizasyon durumlarını göster
        console.log('📅 Son Senkronizasyon Zamanları:');
        const syncStates = await syncStateService.getAllSyncStates();

        syncStates.forEach(state => {
            const time = state.son_senkronizasyon_zamani
                ? new Date(state.son_senkronizasyon_zamani).toLocaleString('tr-TR')
                : 'Henüz yapılmadı';
            const status = state.basarili ? '✅' : '❌';
            console.log(`   ${status} ${state.tablo_adi} (${state.yon}): ${time}`);
        });

        console.log('\n✅ Senkronizasyon başarıyla tamamlandı!\n');

    } catch (error) {
        console.error('\n❌ HATA:', error.message);
        logger.error('İnkremental senkronizasyon hatası:', error);
        process.exit(1);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

// Komut satırı argümanlarını kontrol et
const args = process.argv.slice(2);
const fullSync = args.includes('--full') || args.includes('-f');

if (fullSync) {
    console.log('⚠️  TAM SENKRONIZASYON MODU');
    console.log('   Tüm sync_state kayıtları sıfırlanacak!\n');

    (async () => {
        await syncStateService.resetAllSyncStates();
        await incrementalSync();
    })();
} else {
    incrementalSync();
}
