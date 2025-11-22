require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function testForeignKeys() {
  try {
    console.log('='.repeat(70));
    console.log('FOREIGN KEY KONTROLÜ');
    console.log('='.repeat(70));
    console.log();

    // 1. Tüm Foreign Key'leri Listele
    console.log('1. Mevcut Foreign Key\'ler...');
    const foreignKeys = await pgService.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN (
          'cari_hesap_hareketleri',
          'stok_hareketleri',
          'urun_barkodlari',
          'urun_fiyat_listeleri',
          'satis_kalemleri',
          'tahsilatlar'
        )
      ORDER BY tc.table_name, kcu.column_name
    `);

    console.log(`   Toplam Foreign Key: ${foreignKeys.length}`);
    console.log();
    
    foreignKeys.forEach(fk => {
      console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      console.log(`   Constraint: ${fk.constraint_name}`);
      console.log();
    });

    // 2. Cari Hesap Hareketleri - Foreign Key Kontrolü
    console.log('2. Cari Hesap Hareketleri - Foreign Key Kontrolü...');
    const cariHareketOrphan = await pgService.query(`
      SELECT COUNT(*) as count
      FROM cari_hesap_hareketleri chh
      LEFT JOIN cari_hesaplar ch ON ch.id = chh.cari_hesap_id
      WHERE ch.id IS NULL
    `);
    
    if (cariHareketOrphan[0].count > 0) {
      console.log(`   ⚠ ${cariHareketOrphan[0].count} hareket cari ile eşleşmiyor`);
      
      // Örnek kayıtlar
      const samples = await pgService.query(`
        SELECT chh.id, chh.cari_hesap_id, chh.belge_no
        FROM cari_hesap_hareketleri chh
        LEFT JOIN cari_hesaplar ch ON ch.id = chh.cari_hesap_id
        WHERE ch.id IS NULL
        LIMIT 5
      `);
      
      console.log('   Örnek eşleşmeyen kayıtlar:');
      samples.forEach(s => {
        console.log(`   - ID: ${s.id}, Cari ID: ${s.cari_hesap_id}, Belge: ${s.belge_no}`);
      });
    } else {
      console.log('   ✓ Tüm hareketler cari ile eşleşiyor');
    }

    console.log();

    // 3. Stok Hareketleri - Foreign Key Kontrolü
    console.log('3. Stok Hareketleri - Foreign Key Kontrolü...');
    
    // Stok kontrolü
    const stokHareketStokOrphan = await pgService.query(`
      SELECT COUNT(*) as count
      FROM stok_hareketleri sh
      LEFT JOIN stoklar s ON s.id = sh.stok_id
      WHERE s.id IS NULL
    `);
    
    if (stokHareketStokOrphan[0].count > 0) {
      console.log(`   ⚠ ${stokHareketStokOrphan[0].count} hareket stok ile eşleşmiyor`);
    } else {
      console.log('   ✓ Tüm hareketler stok ile eşleşiyor');
    }

    // Cari kontrolü
    const stokHareketCariOrphan = await pgService.query(`
      SELECT COUNT(*) as count
      FROM stok_hareketleri sh
      LEFT JOIN cari_hesaplar ch ON ch.id = sh.cari_hesap_id
      WHERE ch.id IS NULL
    `);
    
    if (stokHareketCariOrphan[0].count > 0) {
      console.log(`   ⚠ ${stokHareketCariOrphan[0].count} hareket cari ile eşleşmiyor`);
    } else {
      console.log('   ✓ Tüm hareketler cari ile eşleşiyor');
    }

    console.log();

    // 4. Barkod - Foreign Key Kontrolü
    console.log('4. Barkod - Foreign Key Kontrolü...');
    const barkodOrphan = await pgService.query(`
      SELECT COUNT(*) as count
      FROM urun_barkodlari ub
      LEFT JOIN stoklar s ON s.id = ub.stok_id
      WHERE s.id IS NULL
    `);
    
    if (barkodOrphan[0].count > 0) {
      console.log(`   ⚠ ${barkodOrphan[0].count} barkod stok ile eşleşmiyor`);
    } else {
      console.log('   ✓ Tüm barkodlar stok ile eşleşiyor');
    }

    console.log();

    // 5. Fiyat - Foreign Key Kontrolü
    console.log('5. Fiyat - Foreign Key Kontrolü...');
    
    // Stok kontrolü
    const fiyatStokOrphan = await pgService.query(`
      SELECT COUNT(*) as count
      FROM urun_fiyat_listeleri ufl
      LEFT JOIN stoklar s ON s.id = ufl.stok_id
      WHERE s.id IS NULL
    `);
    
    if (fiyatStokOrphan[0].count > 0) {
      console.log(`   ⚠ ${fiyatStokOrphan[0].count} fiyat stok ile eşleşmiyor`);
    } else {
      console.log('   ✓ Tüm fiyatlar stok ile eşleşiyor');
    }

    // Fiyat tanımı kontrolü
    const fiyatTanimOrphan = await pgService.query(`
      SELECT COUNT(*) as count
      FROM urun_fiyat_listeleri ufl
      LEFT JOIN fiyat_tanimlari ft ON ft.id = ufl.fiyat_tanimi_id
      WHERE ft.id IS NULL
    `);
    
    if (fiyatTanimOrphan[0].count > 0) {
      console.log(`   ⚠ ${fiyatTanimOrphan[0].count} fiyat tanım ile eşleşmiyor`);
    } else {
      console.log('   ✓ Tüm fiyatlar tanım ile eşleşiyor');
    }

    console.log();

    // 6. Foreign Key Constraint Durumu
    console.log('6. Foreign Key Constraint Durumu...');
    const constraintStatus = await pgService.query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name,
        confrelid::regclass as referenced_table,
        convalidated as is_validated
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid::regclass::text IN (
          'cari_hesap_hareketleri',
          'stok_hareketleri',
          'urun_barkodlari',
          'urun_fiyat_listeleri'
        )
      ORDER BY conrelid::regclass::text
    `);

    console.log(`   Toplam Constraint: ${constraintStatus.length}`);
    constraintStatus.forEach(c => {
      const status = c.is_validated ? '✓ Aktif' : '⚠ Pasif';
      console.log(`   ${status} ${c.constraint_name}`);
      console.log(`      ${c.table_name} → ${c.referenced_table}`);
    });

    console.log();

    // 7. Öneriler
    console.log('7. Öneriler...');
    console.log('-'.repeat(70));
    
    const totalOrphans = 
      parseInt(cariHareketOrphan[0].count) +
      parseInt(stokHareketStokOrphan[0].count) +
      parseInt(stokHareketCariOrphan[0].count) +
      parseInt(barkodOrphan[0].count) +
      parseInt(fiyatStokOrphan[0].count) +
      parseInt(fiyatTanimOrphan[0].count);

    if (totalOrphans > 0) {
      console.log('\n   ⚠ SORUN TESPİT EDİLDİ:');
      console.log(`   Toplam ${totalOrphans} kayıt foreign key ile eşleşmiyor`);
      console.log();
      console.log('   ÇÖZÜM ÖNERİLERİ:');
      console.log('   1. Bulk sync sırasında trigger\'ları devre dışı bırakın');
      console.log('   2. Eksik kayıtları otomatik oluşturun');
      console.log('   3. Foreign key constraint\'leri geçici olarak kaldırın');
      console.log('   4. Senkronizasyon sonrası tekrar ekleyin');
    } else {
      console.log('   ✓ Sorun tespit edilmedi');
      console.log('   ✓ Tüm foreign key\'ler düzgün çalışıyor');
    }

    console.log();
    console.log('='.repeat(70));
    console.log('✓ KONTROL TAMAMLANDI');
    console.log('='.repeat(70));

  } catch (error) {
    console.error();
    console.error('='.repeat(70));
    console.error('✗ KONTROL BAŞARISIZ!');
    console.error('='.repeat(70));
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgService.disconnect();
    process.exit(0);
  }
}

testForeignKeys();
