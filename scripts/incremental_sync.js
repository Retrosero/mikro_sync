const stokProcessor = require('../sync-jobs/stok.processor');
const fiyatProcessor = require('../sync-jobs/fiyat.processor');
const cariProcessor = require('../sync-jobs/cari.processor');
const cariHareketProcessor = require('../sync-jobs/cari-hareket.processor');
const stokHareketProcessor = require('../sync-jobs/stok-hareket.processor');
const eldekiMiktarProcessor = require('../sync-jobs/eldeki-miktar.processor');
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
        barkodlar: 0,
        fiyatlar: 0,
        cariler: 0,
        cariHareketler: 0,
        stokHareketler: 0
    };

    try {
        // 1. STOK SENKRONIZASYONU
        console.log('📦 STOK SENKRONIZASYONU\n');
        stats.stoklar = await stokProcessor.syncToWeb();
        console.log(`✅ ${stats.stoklar} stok senkronize edildi\n`);

        // 2. BARKOD SENKRONIZASYONU
        console.log('🏷️  BARKOD SENKRONIZASYONU\n');
        stats.barkodlar = await stokProcessor.syncBarkodlarIncremental();
        console.log(`✅ ${stats.barkodlar} barkod senkronize edildi\n`);

        // 3. FİYAT SENKRONIZASYONU
        console.log('💰 FİYAT SENKRONIZASYONU\n');
        const fiyatMappingCount = await pgService.queryOne('SELECT COUNT(*) as count FROM int_kodmap_fiyat_liste');
        if (fiyatMappingCount.count > 0) {
            stats.fiyatlar = await fiyatProcessor.syncToWeb();
            console.log(`✅ ${stats.fiyatlar} fiyat senkronize edildi\n`);
        } else {
            console.log('⚠️  Fiyat mapping bulunamadı, atlanıyor.\n');
        }

        // 4. CARİ SENKRONIZASYONU
        console.log('👥 CARİ SENKRONIZASYONU\n');
        stats.cariler = await cariProcessor.syncToWeb();
        console.log(`✅ ${stats.cariler} cari senkronize edildi\n`);

        // 5. CARİ HAREKET SENKRONIZASYONU
        console.log('📄 CARİ HAREKET SENKRONIZASYONU\n');
        stats.cariHareketler = await cariHareketProcessor.syncToWeb();
        console.log(`✅ ${stats.cariHareketler} cari hareket senkronize edildi\n`);

        // 6. STOK HAREKET SENKRONIZASYONU
        console.log('🚚 STOK HAREKET SENKRONIZASYONU\n');
        stats.stokHareketler = await stokHareketProcessor.syncToWeb();
        console.log(`✅ ${stats.stokHareketler} stok hareket senkronize edildi\n`);

        // 7. ELDEKİ MİKTAR SENKRONIZASYONU
        console.log('📦 ELDEKİ MİKTAR SENKRONIZASYONU\n');
        stats.eldekiMiktarlar = await eldekiMiktarProcessor.syncToWeb();
        console.log(`✅ ${stats.eldekiMiktarlar} eldeki miktar senkronize edildi\n`);

        // ÖZET RAPOR
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);

        console.log('═══════════════════════════════════════════════════════');
        console.log('  SENKRONIZASYON TAMAMLANDI');
        console.log('═══════════════════════════════════════════════════════\n');
        console.log(`📊 Sonuçlar:`);
        console.log(`   Stok           : ${stats.stoklar}`);
        console.log(`   Barkod         : ${stats.barkodlar}`);
        console.log(`   Fiyat          : ${stats.fiyatlar}`);
        console.log(`   Cari           : ${stats.cariler}`);
        console.log(`   Cari Hareket   : ${stats.cariHareketler}`);
        console.log(`   Stok Hareket   : ${stats.stokHareketler}`);
        console.log(`   Eldeki Miktar  : ${stats.eldekiMiktarlar}`);
        console.log(`   Süre           : ${duration} saniye\n`);

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
