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
      'barkod_tanimlari',
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

    // Import STOKLAR
    console.log('\n  Stoklar aktarılıyor...');
    const stoklar = await mssqlService.query(`
      SELECT * FROM STOKLAR 
      WHERE sto_kod IS NOT NULL AND sto_isim IS NOT NULL
    `);
    console.log(`  ${stoklar.length} stok kaydı bulundu`);

    let stokCount = 0;
    for (const stok of stoklar) {
      try {
        await pgService.query(`
          INSERT INTO stoklar (
            id, stok_kodu, stok_adi, birim_turu, aktif, 
            olusturma_tarihi, guncelleme_tarihi
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()
          )
        `, [
          stok.sto_kod,
          stok.sto_isim,
          stok.sto_birim1_ad || 'ADET'
        ]);
        stokCount++;
      } catch (err) {
        console.log(`    ⚠ Stok ${stok.sto_kod} atlanadı: ${err.message}`);
      }
    }
    console.log(`  ✓ ${stokCount} stok aktarıldı`);

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
