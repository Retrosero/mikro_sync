require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function migrateData() {
  try {
    console.log('='.repeat(60));
    console.log('ERP → Web Veri Aktarımı Başlıyor');
    console.log('='.repeat(60));

    // Disable triggers
    console.log('\nTrigger\'lar geçici olarak devre dışı bırakılıyor...');
    await pgService.query('SET session_replication_role = replica');
    console.log('✓ Trigger\'lar devre dışı');

    // Step 1: Clean tables
    console.log('\n[1/4] Tablolar temizleniyor...');
    const tablesToClean = [
      'urun_barkodlari',
      'stok_satis_fiyat_listeleri',
      'stok_hareketleri',
      'cari_hesap_hareketleri',
      'stoklar',
      'cari_hesaplar'
    ];

    for (const table of tablesToClean) {
      await pgService.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`  ✓ ${table} temizlendi`);
    }

    // Step 2: Import master data
    console.log('\n[2/4] Ana veriler aktarılıyor...');

    // Import MARKALAR first
    console.log('\n  Markalar aktarılıyor...');
    const markalar = await mssqlService.query(`
      SELECT DISTINCT sto_marka_kodu 
      FROM STOKLAR 
      WHERE sto_marka_kodu IS NOT NULL AND sto_marka_kodu != ''
    `);
    console.log(`  ${markalar.length} marka bulundu`);

    const markaMap = new Map(); // Brand Name -> UUID

    for (const m of markalar) {
      const markaAdi = m.sto_marka_kodu.trim();
      if (!markaAdi) continue;

      try {
        // Check if exists or insert
        let result = await pgService.query('SELECT id FROM markalar WHERE marka_adi = $1', [markaAdi]);

        if (result.length === 0) {
          result = await pgService.query(`
            INSERT INTO markalar (id, marka_adi, aktif, olusturma_tarihi, guncelleme_tarihi)
            VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
            RETURNING id
          `, [markaAdi]);
        }

        markaMap.set(markaAdi, result[0].id);
      } catch (err) {
        console.log(`    ⚠ Marka ${markaAdi} hatası: ${err.message}`);
      }
    }
    console.log(`  ✓ ${markaMap.size} marka işlendi`);

    // Import STOKLAR with Quantity from View
    console.log('\n  Stoklar ve Miktarlar aktarılıyor...');
    const stoklar = await mssqlService.query(`
      SELECT s.*, v.sth_eldeki_miktar 
      FROM STOKLAR s
      LEFT JOIN STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW v ON s.sto_kod = v.sth_stok_kod
      WHERE s.sto_kod IS NOT NULL AND s.sto_isim IS NOT NULL
    `);
    console.log(`  ${stoklar.length} stok kaydı bulundu`);

    let stokCount = 0;
    for (const stok of stoklar) {
      try {
        const markaAdi = stok.sto_marka_kodu ? stok.sto_marka_kodu.trim() : '';
        const markaId = markaMap.get(markaAdi) || null;

        await pgService.query(`
          INSERT INTO stoklar (
            id, stok_kodu, stok_adi, birim_turu, aktif, 
            olusturma_tarihi, guncelleme_tarihi,
            marka_id, olcu, koliadeti, raf_kodu,
            eldeki_miktar
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, true, NOW(), NOW(),
            $4, $5, $6, $7, $8
          )
        `, [
          stok.sto_kod,
          stok.sto_isim,
          stok.sto_birim1_ad || 'ADET',
          markaId,
          stok.sto_sektor_kodu || null, // Ölçü
          stok.sto_kalkon_kodu || null, // Koli Adeti
          stok.sto_yer_kod || null,     // Raf Kodu
          stok.sth_eldeki_miktar || 0   // Eldeki Miktar
        ]);
        stokCount++;
      } catch (err) {
        console.log(`    ⚠ Stok ${stok.sto_kod} atlanadı: ${err.message}`);
      }
    }
    console.log(`  ✓ ${stokCount} stok aktarıldı`);

    // Import BARKODLAR -> urun_barkodlari
    console.log('\n  Barkodlar aktarılıyor...');
    // Clean urun_barkodlari first
    await pgService.query('TRUNCATE TABLE urun_barkodlari CASCADE');

    const barkodlar = await mssqlService.query(`
      SELECT bar_kodu, bar_stokkodu, bar_birimi 
      FROM BARKOD_TANIMLARI 
      WHERE bar_kodu IS NOT NULL AND bar_stokkodu IS NOT NULL
    `);
    console.log(`  ${barkodlar.length} barkod bulundu`);

    let barkodCount = 0;
    for (const bar of barkodlar) {
      try {
        // Find stok_id from stok_kodu
        const stokResult = await pgService.query('SELECT id FROM stoklar WHERE stok_kodu = $1', [bar.bar_stokkodu]);
        if (stokResult.length > 0) {
          await pgService.query(`
            INSERT INTO urun_barkodlari (
              id, stok_id, barkod, barkod_tipi, aktif,
              olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
              gen_random_uuid(), $1, $2, 'EAN13', true, NOW(), NOW()
            )
          `, [stokResult[0].id, bar.bar_kodu]);
          barkodCount++;
        }
      } catch (err) {
        // Duplicate barcode or other error
        // console.log(`    ⚠ Barkod ${bar.bar_kodu} hatası: ${err.message}`);
      }
    }
    console.log(`  ✓ ${barkodCount} barkod aktarıldı`);

    // Import CARI_HESAPLAR
    console.log('\n  Cari hesaplar aktarılıyor...');
    const cariler = await mssqlService.query(`
      SELECT * FROM CARI_HESAPLAR 
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

    // Step 3: Create mappings
    console.log('\n[3/4] Mapping\'ler oluşturuluyor...');

    // Stok mappings
    const webStoklar = await pgService.query('SELECT id, stok_kodu FROM stoklar');
    for (const stok of webStoklar) {
      await pgService.query(`
        INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (erp_stok_kod) DO UPDATE SET web_stok_id = EXCLUDED.web_stok_id
      `, [stok.id, stok.stok_kodu]);
    }
    console.log(`  ✓ ${webStoklar.length} stok mapping oluşturuldu`);

    // Cari mappings
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

    // Step 4: Verification
    console.log('\n[4/4] Doğrulama...');
    const counts = {};
    for (const table of tablesToClean) {
      const result = await pgService.query(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = result[0].count;
      console.log(`  ${table}: ${counts[table]} kayıt`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Veri aktarımı tamamlandı!');
    console.log('='.repeat(60));

    await pgService.disconnect();
    await mssqlService.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    console.error(error);
    // Re-enable triggers even on error
    try {
      await pgService.query('SET session_replication_role = DEFAULT');
    } catch (e) { }
    await pgService.disconnect();
    await mssqlService.disconnect();
    process.exit(1);
  }
}

migrateData();
