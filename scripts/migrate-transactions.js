require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function migrateTransactions() {
  try {
    console.log('='.repeat(60));
    console.log('ERP → Web Hareket Tabloları Aktarımı (Test - 100 Kayıt)');
    console.log('='.repeat(60));

    // Disable triggers
    console.log('\nTrigger\'lar geçici olarak devre dışı bırakılıyor...');
    await pgService.query('SET session_replication_role = replica');
    console.log('✓ Trigger\'lar devre dışı');

    // Clean transaction tables
    console.log('\n[1/3] Hareket tabloları temizleniyor...');
    await pgService.query('TRUNCATE TABLE cari_hesap_hareketleri CASCADE');
    console.log('  ✓ cari_hesap_hareketleri temizlendi');
    await pgService.query('TRUNCATE TABLE stok_hareketleri CASCADE');
    console.log('  ✓ stok_hareketleri temizlendi');

    // Import CARI_HESAP_HAREKETLERI
    console.log('\n[2/3] Cari hesap hareketleri aktarılıyor...');
    const cariHareketler = await mssqlService.query(`
      SELECT TOP 100 * FROM CARI_HESAP_HAREKETLERI
      WHERE cha_kod IS NOT NULL
      ORDER BY cha_create_date DESC
    `);
    console.log(`  ${cariHareketler.length} cari hareket kaydı bulundu`);

    let cariHareketCount = 0;
    for (const hareket of cariHareketler) {
      try {
        const cariMapping = await pgService.query(`
          SELECT web_cari_id FROM int_kodmap_cari WHERE erp_cari_kod = $1
        `, [hareket.cha_kod]);

        if (cariMapping.length > 0) {
          const tutar = hareket.cha_meblag || 0;
          await pgService.query(`
            INSERT INTO cari_hesap_hareketleri (
              id, cari_hesap_id, hareket_tipi, tutar, onceki_bakiye, sonraki_bakiye,
              belge_no, belge_tipi, aciklama, islem_tarihi, olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, 0, $3, $4, $5, $6, $7, NOW(), NOW()
            )
          `, [
            cariMapping[0].web_cari_id,
            hareket.cha_tip || 0,
            tutar,
            (hareket.cha_evrakno_seri || '') + (hareket.cha_evrakno_sira || ''),
            hareket.cha_evrak_tip || 0,
            hareket.cha_aciklama || '',
            hareket.cha_tarihi || new Date()
          ]);
          cariHareketCount++;
        }
      } catch (err) {
        console.log(`    ⚠ Cari hareket atlanadı: ${err.message}`);
      }
    }
    console.log(`  ✓ ${cariHareketCount} cari hareket aktarıldı`);

    // Import STOK_HAREKETLERI
    console.log('\n[3/3] Stok hareketleri aktarılıyor...');
    const stokHareketler = await mssqlService.query(`
      SELECT TOP 100 * FROM STOK_HAREKETLERI
      WHERE sth_stok_kod IS NOT NULL
      ORDER BY sth_create_date DESC
    `);
    console.log(`  ${stokHareketler.length} stok hareket kaydı bulundu`);

    let stokHareketCount = 0;
    for (const hareket of stokHareketler) {
      try {
        const stokMapping = await pgService.query(`
          SELECT web_stok_id FROM int_kodmap_stok WHERE erp_stok_kod = $1
        `, [hareket.sth_stok_kod]);

        if (stokMapping.length > 0) {
          const miktar = hareket.sth_miktar || 0;
          const birimFiyat = hareket.sth_birim_fiyat || 0;
          await pgService.query(`
            INSERT INTO stok_hareketleri (
              id, stok_id, hareket_tipi, miktar, onceki_miktar, sonraki_miktar,
              birim_fiyat, toplam_tutar, belge_no, belge_tipi, aciklama, islem_tarihi,
              olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, 0, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
            )
          `, [
            stokMapping[0].web_stok_id,
            hareket.sth_tip || 0,
            miktar,
            birimFiyat,
            miktar * birimFiyat,
            (hareket.sth_evrakno_seri || '') + (hareket.sth_evrakno_sira || ''),
            hareket.sth_evraktip || 0,
            hareket.sth_aciklama || '',
            hareket.sth_tarihi || new Date()
          ]);
          stokHareketCount++;
        }
      } catch (err) {
        console.log(`    ⚠ Stok hareket atlanadı: ${err.message}`);
      }
    }
    console.log(`  ✓ ${stokHareketCount} stok hareket aktarıldı`);

    // Re-enable triggers
    console.log('\nTrigger\'lar tekrar aktif ediliyor...');
    await pgService.query('SET session_replication_role = DEFAULT');
    console.log('✓ Trigger\'lar aktif');

    // Verification
    console.log('\nDoğrulama...');
    const cariCount = await pgService.query('SELECT COUNT(*) as count FROM cari_hesap_hareketleri');
    const stokCount = await pgService.query('SELECT COUNT(*) as count FROM stok_hareketleri');
    console.log(`  cari_hesap_hareketleri: ${cariCount[0].count} kayıt`);
    console.log(`  stok_hareketleri: ${stokCount[0].count} kayıt`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Hareket tabloları aktarımı tamamlandı!');
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

migrateTransactions();
