require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function migrateCariAndBanks() {
  try {
    console.log('='.repeat(60));
    console.log('ERP → Web: Tüm Cari ve Banka Aktarımı');
    console.log('='.repeat(60));

    // Disable triggers
    console.log('\nTrigger\'lar geçici olarak devre dışı bırakılıyor...');
    await pgService.query('SET session_replication_role = replica');
    console.log('✓ Trigger\'lar devre dışı');

    // Clean tables
    console.log('\n[1/3] Tablolar temizleniyor...');
    await pgService.query('TRUNCATE TABLE bankalar CASCADE');
    console.log('  ✓ bankalar temizlendi');
    await pgService.query('TRUNCATE TABLE cari_hesaplar CASCADE');
    console.log('  ✓ cari_hesaplar temizlendi');
    await pgService.query('TRUNCATE TABLE int_kodmap_cari CASCADE');
    console.log('  ✓ int_kodmap_cari temizlendi');
    await pgService.query('TRUNCATE TABLE int_kodmap_banka CASCADE');
    console.log('  ✓ int_kodmap_banka temizlendi');

    // Import ALL CARI_HESAPLAR
    console.log('\n[2/3] Tüm cari hesaplar aktarılıyor...');
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
            id, cari_kodu, cari_adi, telefon, adres, vergi_no, vergi_dairesi,
            aktif, olusturma_tarihi, guncelleme_tarihi
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, NOW(), NOW()
          )
        `, [
          cari.cari_kod,
          cari.cari_unvan1,
          cari.cari_tel1,
          cari.cari_cadde,
          cari.cari_VergiKimlikNo,
          cari.cari_vdaire_adi
        ]);
        cariCount++;
        if (cariCount % 100 === 0) {
          console.log(`    ${cariCount} cari aktarıldı...`);
        }
      } catch (err) {
        console.log(`    ⚠ Cari ${cari.cari_kod} atlanadı: ${err.message}`);
      }
    }
    console.log(`  ✓ ${cariCount} cari aktarıldı`);

    // Import ALL BANKALAR
    console.log('\n[3/3] Tüm bankalar aktarılıyor...');
    const bankalar = await mssqlService.query(`
      SELECT * FROM BANKALAR
      WHERE ban_kod IS NOT NULL
    `);
    console.log(`  ${bankalar.length} banka kaydı bulundu`);

    let bankaCount = 0;
    for (const banka of bankalar) {
      try {
        await pgService.query(`
          INSERT INTO bankalar (
            id, banka_adi, sube_adi, hesap_no, iban,
            aktif, olusturma_tarihi, guncelleme_tarihi
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()
          )
        `, [
          banka.ban_ismi || banka.ban_kod || '',
          banka.ban_sube || '',
          banka.ban_hesapno || '',
          banka.ban_IBANKodu || ''
        ]);
        bankaCount++;
      } catch (err) {
        console.log(`    ⚠ Banka ${banka.ban_kod} atlanadı: ${err.message}`);
      }
    }
    console.log(`  ✓ ${bankaCount} banka aktarıldı`);

    // Create mappings
    console.log('\nMapping\'ler oluşturuluyor...');

    // Cari mappings
    const webCariler = await pgService.query('SELECT id, cari_kodu FROM cari_hesaplar');
    console.log(`  ${webCariler.length} web cari bulundu, mapping oluşturuluyor...`);

    for (const cari of webCariler) {
      await pgService.query(`
        INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (erp_cari_kod) DO UPDATE SET web_cari_id = EXCLUDED.web_cari_id
      `, [cari.id, cari.cari_kodu]);
    }
    console.log(`  ✓ ${webCariler.length} cari mapping oluşturuldu`);

    // Banka mappings - using banka_adi as key
    const webBankalar = await pgService.query('SELECT id, banka_adi FROM bankalar');
    console.log(`  ${webBankalar.length} web banka bulundu, mapping oluşturuluyor...`);

    for (const banka of webBankalar) {
      // Find original banka code
      const originalBanka = bankalar.find(b => (b.ban_ismi || b.ban_kod) === banka.banka_adi);
      if (originalBanka) {
        await pgService.query(`
          INSERT INTO int_kodmap_banka (web_banka_id, erp_banka_kod, created_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (erp_banka_kod) DO UPDATE SET web_banka_id = EXCLUDED.web_banka_id
        `, [banka.id, originalBanka.ban_kod]);
      }
    }
    console.log(`  ✓ ${webBankalar.length} banka mapping oluşturuldu`);

    // Re-enable triggers
    console.log('\nTrigger\'lar tekrar aktif ediliyor...');
    await pgService.query('SET session_replication_role = DEFAULT');
    console.log('✓ Trigger\'lar aktif');

    // Verification
    console.log('\nDoğrulama...');
    const cariCountFinal = await pgService.query('SELECT COUNT(*) as count FROM cari_hesaplar');
    const bankaCountFinal = await pgService.query('SELECT COUNT(*) as count FROM bankalar');
    const cariMapCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_cari');
    const bankaMapCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_banka');

    console.log(`  cari_hesaplar: ${cariCountFinal[0].count} kayıt`);
    console.log(`  bankalar: ${bankaCountFinal[0].count} kayıt`);
    console.log(`  int_kodmap_cari: ${cariMapCount[0].count} kayıt`);
    console.log(`  int_kodmap_banka: ${bankaMapCount[0].count} kayıt`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Cari ve Banka aktarımı tamamlandı!');
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

migrateCariAndBanks();
