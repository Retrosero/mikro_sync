require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function migrateData() {
    try {
        console.log('='.repeat(60));
        console.log('ERP → Web Veri Aktarımı (Test - 100 Kayıt)');
        console.log('='.repeat(60));

        // Disable triggers
        console.log('\nTrigger\'lar geçici olarak devre dışı bırakılıyor...');
        await pgService.query('SET session_replication_role = replica');
        console.log('✓ Trigger\'lar devre dışı');

        // Step 1: Clean tables (skip stoklar - already done)
        console.log('\n[1/5] Tablolar temizleniyor (stoklar hariç)...');
        const tablesToClean = [
            'barkod_tanimlari',
            'stok_satis_fiyat_listeleri',
            'cari_hesaplar'
        ];

        for (const table of tablesToClean) {
            await pgService.query(`TRUNCATE TABLE ${table} CASCADE`);
            console.log(`  ✓ ${table} temizlendi`);
        }

        // Step 2: Import CARI_HESAPLAR
        console.log('\n[2/5] Cari hesaplar aktarılıyor...');
        const cariler = await mssqlService.query(`
      SELECT TOP 100 * FROM CARI_HESAPLAR 
      WHERE cari_kod IS NOT NULL AND cari_unvan1 IS NOT NULL
    `);
        console.log(`  ${cariler.length} cari kaydı bulundu`);

        let cariCount = 0;
        for (const cari of cariler) {
            try {
                await pgService.query(`
          INSERT INTO cari_hesaplar (
            id, cari_kodu, cari_adi, telefon, adres, aktif,
            olusturma_tarihi, guncelleme_tarihi
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()
          )
        `, [
                    cari.cari_kod,
                    cari.cari_unvan1,
                    cari.cari_tel1,
                    cari.cari_cadde
                ]);
                cariCount++;
            } catch (err) {
                console.log(`    ⚠ Cari ${cari.cari_kod} atlanadı: ${err.message}`);
            }
        }
        console.log(`  ✓ ${cariCount} cari aktarıldı`);

        // Step 3: Import BARKOD_TANIMLARI
        console.log('\n[3/5] Barkodlar aktarılıyor...');
        const barkodlar = await mssqlService.query(`
      SELECT TOP 100 * FROM BARKOD_TANIMLARI
      WHERE bar_kodu IS NOT NULL
    `);
        console.log(`  ${barkodlar.length} barkod kaydı bulundu`);

        let barkodCount = 0;
        for (const barkod of barkodlar) {
            try {
                // Find stok_id from mapping
                const stokMapping = await pgService.query(`
          SELECT web_stok_id FROM int_kodmap_stok WHERE erp_stok_kod = $1
        `, [barkod.bar_stokkodu]);

                if (stokMapping.length > 0) {
                    await pgService.query(`
            INSERT INTO barkod_tanimlari (
              id, stok_id, barkod, aktif, olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
              gen_random_uuid(), $1, $2, true, NOW(), NOW()
            )
          `, [
                        stokMapping[0].web_stok_id,
                        barkod.bar_kodu
                    ]);
                    barkodCount++;
                }
            } catch (err) {
                console.log(`    ⚠ Barkod ${barkod.bar_kodu} atlanadı: ${err.message}`);
            }
        }
        console.log(`  ✓ ${barkodCount} barkod aktarıldı`);

        // Step 4: Import STOK_SATIS_FIYAT_LISTELERI
        console.log('\n[4/5] Fiyat listeleri aktarılıyor...');
        const fiyatlar = await mssqlService.query(`
      SELECT TOP 100 * FROM STOK_SATIS_FIYAT_LISTELERI
      WHERE sfiyat_stokkod IS NOT NULL
    `);
        console.log(`  ${fiyatlar.length} fiyat kaydı bulundu`);

        let fiyatCount = 0;
        for (const fiyat of fiyatlar) {
            try {
                const stokMapping = await pgService.query(`
          SELECT web_stok_id FROM int_kodmap_stok WHERE erp_stok_kod = $1
        `, [fiyat.sfiyat_stokkod]);

                if (stokMapping.length > 0) {
                    await pgService.query(`
            INSERT INTO stok_satis_fiyat_listeleri (
              id, stok_id, fiyat, doviz_cinsi, aktif,
              olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()
            )
          `, [
                        stokMapping[0].web_stok_id,
                        fiyat.sfiyat_fiyati || 0,
                        fiyat.sfiyat_doviz || 0
                    ]);
                    fiyatCount++;
                }
            } catch (err) {
                console.log(`    ⚠ Fiyat atlanadı: ${err.message}`);
            }
        }
        console.log(`  ✓ ${fiyatCount} fiyat aktarıldı`);

        // Step 5: Create cari mappings
        console.log('\n[5/5] Cari mapping\'ler oluşturuluyor...');
        const webCariler = await pgService.query('SELECT id, cari_kodu FROM cari_hesaplar');
        for (const cari of webCariler) {
            await pgService.query(`
        INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (erp_cari_kod) DO UPDATE SET web_cari_id = EXCLUDED.web_cari_id
      `, [cari.id, cari.cari_kodu]);
        }
        console.log(`  ✓ ${webCariler.length} cari mapping oluşturuldu`);

        // Re-enable triggers
        console.log('\nTrigger\'lar tekrar aktif ediliyor...');
        await pgService.query('SET session_replication_role = DEFAULT');
        console.log('✓ Trigger\'lar aktif');

        // Verification
        console.log('\nDoğrulama...');
        const stokCount = await pgService.query('SELECT COUNT(*) as count FROM stoklar');
        const cariCountFinal = await pgService.query('SELECT COUNT(*) as count FROM cari_hesaplar');
        const barkodCountFinal = await pgService.query('SELECT COUNT(*) as count FROM barkod_tanimlari');
        const fiyatCountFinal = await pgService.query('SELECT COUNT(*) as count FROM stok_satis_fiyat_listeleri');

        console.log(`  stoklar: ${stokCount[0].count} kayıt`);
        console.log(`  cari_hesaplar: ${cariCountFinal[0].count} kayıt`);
        console.log(`  barkod_tanimlari: ${barkodCountFinal[0].count} kayıt`);
        console.log(`  stok_satis_fiyat_listeleri: ${fiyatCountFinal[0].count} kayıt`);

        console.log('\n' + '='.repeat(60));
        console.log('✅ Veri aktarımı tamamlandı!');
        console.log('='.repeat(60));

        await pgService.disconnect();
        await mssqlService.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Hata:', error.message);
        console.error(error);
        try {
            await pgService.query('SET session_replication_role = DEFAULT');
        } catch (e) { }
        await pgService.disconnect();
        await mssqlService.disconnect();
        process.exit(1);
    }
}

migrateData();
