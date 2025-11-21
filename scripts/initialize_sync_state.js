const pgService = require('../services/postgresql.service');

async function initializeSyncState() {
    try {
        console.log('Mevcut veri durumu kontrol ediliyor...\n');

        // Stok sayısını kontrol et
        const stokCount = await pgService.queryOne('SELECT COUNT(*) as count FROM stoklar');
        console.log(`Mevcut stok sayısı: ${stokCount.count}`);

        if (stokCount.count > 0) {
            console.log('Stoklar zaten mevcut. Sync state başlatılıyor...\n');

            // Şu anki zamanı son senkronizasyon zamanı olarak kaydet
            const now = new Date();

            await pgService.query(`
        INSERT INTO sync_state (tablo_adi, yon, son_senkronizasyon_zamani, kayit_sayisi, basarili)
        VALUES ('STOKLAR', 'erp_to_web', $1, $2, true)
        ON CONFLICT (tablo_adi, yon) 
        DO UPDATE SET 
          son_senkronizasyon_zamani = $1,
          kayit_sayisi = $2,
          basarili = true,
          guncelleme_tarihi = NOW()
      `, [now, stokCount.count]);

            console.log(`✅ STOKLAR sync state oluşturuldu (${now.toLocaleString('tr-TR')})`);
        }

        // Fiyat sayısını kontrol et
        const fiyatCount = await pgService.queryOne('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');
        console.log(`Mevcut fiyat sayısı: ${fiyatCount.count}`);

        if (fiyatCount.count > 0) {
            const now = new Date();

            await pgService.query(`
        INSERT INTO sync_state (tablo_adi, yon, son_senkronizasyon_zamani, kayit_sayisi, basarili)
        VALUES ('STOK_SATIS_FIYAT_LISTELERI', 'erp_to_web', $1, $2, true)
        ON CONFLICT (tablo_adi, yon) 
        DO UPDATE SET 
          son_senkronizasyon_zamani = $1,
          kayit_sayisi = $2,
          basarili = true,
          guncelleme_tarihi = NOW()
      `, [now, fiyatCount.count]);

            console.log(`✅ STOK_SATIS_FIYAT_LISTELERI sync state oluşturuldu (${now.toLocaleString('tr-TR')})`);
        }

        console.log('\n✅ Sync state başlatma tamamlandı!');
        console.log('Artık sadece yeni değişiklikler senkronize edilecek.\n');

    } catch (error) {
        console.error('Hata:', error.message);
        process.exit(1);
    } finally {
        await pgService.disconnect();
    }
}

initializeSyncState();
