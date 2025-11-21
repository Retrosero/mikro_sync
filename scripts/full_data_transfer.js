const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const stokProcessor = require('../sync-jobs/stok.processor');
const fiyatProcessor = require('../sync-jobs/fiyat.processor');
const logger = require('../utils/logger');

async function fullDataTransfer() {
    let stats = {
        stoklar: { basarili: 0, hata: 0 },
        barkodlar: { basarili: 0, hata: 0 },
        fiyatlar: { basarili: 0, hata: 0 }
    };

    try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('  ERP → Web Tam Veri Aktarımı Başlatılıyor');
        console.log('═══════════════════════════════════════════════════════\n');

        // 1. STOK AKTARIMI
        console.log('📦 STOK AKTARIMI BAŞLIYOR...\n');

        const stoklar = await mssqlService.query(`
      SELECT 
        sto_kod, sto_isim, sto_birim1_ad, sto_standartmaliyet,
        sto_sektor_kodu, sto_reyon_kodu, sto_ambalaj_kodu, 
        sto_kalkon_kodu, sto_yabanci_isim
      FROM STOKLAR
      WHERE sto_kod IS NOT NULL 
        AND sto_isim IS NOT NULL
        AND sto_pasif_fl = 0
      ORDER BY sto_kod
    `);

        console.log(`Toplam ${stoklar.length} aktif stok bulundu.\n`);

        let processedCount = 0;
        for (const stok of stoklar) {
            try {
                await stokProcessor.syncToWeb(stok);
                stats.stoklar.basarili++;
                processedCount++;

                // Her 50 stokta bir ilerleme göster
                if (processedCount % 50 === 0) {
                    console.log(`  ✓ ${processedCount}/${stoklar.length} stok işlendi...`);
                }
            } catch (error) {
                stats.stoklar.hata++;
                logger.error(`Stok hatası (${stok.sto_kod}):`, error.message);
            }
        }

        console.log(`\n✅ Stok aktarımı tamamlandı!`);
        console.log(`   Başarılı: ${stats.stoklar.basarili}, Hatalı: ${stats.stoklar.hata}\n`);

        // 2. FİYAT AKTARIMI
        console.log('💰 FİYAT AKTARIMI BAŞLIYOR...\n');

        // Önce fiyat mapping'lerini kontrol et
        const fiyatMappings = await pgService.query(`
      SELECT COUNT(*) as count FROM int_kodmap_fiyat_liste
    `);

        if (fiyatMappings[0].count === 0) {
            console.log('⚠️  UYARI: Fiyat mapping\'i bulunamadı!');
            console.log('   Fiyat aktarımı için önce int_kodmap_fiyat_liste tablosunu doldurmanız gerekiyor.\n');
            console.log('   Örnek:');
            console.log('   INSERT INTO int_kodmap_fiyat_liste (web_fiyat_tanimi_id, erp_liste_no, aciklama)');
            console.log('   VALUES (\'<web_uuid>\', 1, \'Satış Fiyatı\');\n');
        } else {
            console.log(`${fiyatMappings[0].count} fiyat mapping\'i bulundu.\n`);

            const fiyatlar = await mssqlService.query(`
        SELECT 
          sfiyat_stokkod, sfiyat_listesirano, sfiyat_fiyati,
          sfiyat_ilktarih, sfiyat_sontarih
        FROM STOK_SATIS_FIYAT_LISTELERI
        WHERE sfiyat_fiyati > 0
        ORDER BY sfiyat_stokkod, sfiyat_listesirano
      `);

            console.log(`Toplam ${fiyatlar.length} fiyat kaydı bulundu.\n`);

            processedCount = 0;
            for (const fiyat of fiyatlar) {
                try {
                    await fiyatProcessor.syncToWeb(fiyat);
                    stats.fiyatlar.basarili++;
                    processedCount++;

                    if (processedCount % 100 === 0) {
                        console.log(`  ✓ ${processedCount}/${fiyatlar.length} fiyat işlendi...`);
                    }
                } catch (error) {
                    stats.fiyatlar.hata++;
                    // Mapping bulunamadı hatalarını loglama (çok fazla olabilir)
                    if (!error.message.includes('mapping bulunamadı')) {
                        logger.error(`Fiyat hatası (${fiyat.sfiyat_stokkod}):`, error.message);
                    }
                }
            }

            console.log(`\n✅ Fiyat aktarımı tamamlandı!`);
            console.log(`   Başarılı: ${stats.fiyatlar.basarili}, Hatalı: ${stats.fiyatlar.hata}\n`);
        }

        // 3. ÖZET RAPOR
        console.log('═══════════════════════════════════════════════════════');
        console.log('  AKTARIM ÖZET RAPORU');
        console.log('═══════════════════════════════════════════════════════\n');

        // Web tarafındaki güncel sayılar
        const webStokCount = await pgService.queryOne('SELECT COUNT(*) as count FROM stoklar');
        const webBarkodCount = await pgService.queryOne('SELECT COUNT(*) as count FROM urun_barkodlari');
        const webFiyatCount = await pgService.queryOne('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');

        console.log('📊 Web Veritabanı Durumu:');
        console.log(`   Toplam Stok       : ${webStokCount.count}`);
        console.log(`   Toplam Barkod     : ${webBarkodCount.count}`);
        console.log(`   Toplam Fiyat      : ${webFiyatCount.count}\n`);

        console.log('📈 Bu Aktarımda:');
        console.log(`   Stok   - Başarılı: ${stats.stoklar.basarili}, Hatalı: ${stats.stoklar.hata}`);
        console.log(`   Fiyat  - Başarılı: ${stats.fiyatlar.basarili}, Hatalı: ${stats.fiyatlar.hata}\n`);

        console.log('✅ Veri aktarımı başarıyla tamamlandı!\n');

    } catch (error) {
        console.error('\n❌ HATA:', error.message);
        logger.error('Veri aktarım hatası:', error);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

// Scripti çalıştır
console.log('Başlatılıyor...\n');
fullDataTransfer();
