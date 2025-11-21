require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');
const eldekiMiktarProcessor = require('./sync-jobs/eldeki-miktar.processor');

async function testEldekiMiktar() {
  try {
    console.log('='.repeat(70));
    console.log('ELDEKİ MİKTAR SENKRONIZASYON TESTİ');
    console.log('='.repeat(70));
    console.log();

    // 1. ERP View Kontrolü
    console.log('1. ERP View kontrolü...');
    try {
      const erpData = await mssqlService.query(`
        SELECT TOP 10 
          sth_stok_kod as stok_kodu,
          sth_eldeki_miktar as eldeki_miktar
        FROM STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW
        WHERE sth_eldeki_miktar IS NOT NULL
        ORDER BY sth_stok_kod
      `);

      console.log(`   ✓ View bulundu: ${erpData.length} örnek kayıt`);
      if (erpData.length > 0) {
        console.log('\n   Örnek veriler:');
        erpData.slice(0, 5).forEach(row => {
          console.log(`   - ${row.stok_kodu}: ${row.eldeki_miktar}`);
        });
      }
    } catch (error) {
      console.error('   ✗ View bulunamadı veya hata:', error.message);
      throw error;
    }

    console.log();

    // 2. Toplam Kayıt Sayısı
    console.log('2. Toplam kayıt sayısı...');
    const totalCount = await mssqlService.query(`
      SELECT COUNT(*) as count 
      FROM STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW
      WHERE sth_eldeki_miktar IS NOT NULL
    `);
    console.log(`   Toplam: ${totalCount[0].count} kayıt`);

    console.log();

    // 3. Web Stok Kontrolü
    console.log('3. Web stok tablosu kontrolü...');
    
    // eldeki_miktar kolonu var mı kontrol et
    try {
      const columnCheck = await pgService.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'stoklar' 
          AND column_name = 'eldeki_miktar'
      `);

      if (columnCheck.length === 0) {
        console.log('   ⚠ eldeki_miktar kolonu bulunamadı, oluşturuluyor...');
        await pgService.query(`
          ALTER TABLE stoklar 
          ADD COLUMN IF NOT EXISTS eldeki_miktar NUMERIC(18,3) DEFAULT 0
        `);
        console.log('   ✓ Kolon oluşturuldu');
      } else {
        console.log('   ✓ eldeki_miktar kolonu mevcut');
      }
    } catch (error) {
      console.error('   ✗ Kolon kontrolü hatası:', error.message);
      throw error;
    }

    console.log();

    // 4. Örnek Senkronizasyon (İlk 100 kayıt)
    console.log('4. Örnek senkronizasyon (ilk 100 kayıt)...');
    
    const testData = await mssqlService.query(`
      SELECT TOP 100
        sth_stok_kod as stok_kodu,
        sth_eldeki_miktar as eldeki_miktar
      FROM STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW
      WHERE sth_eldeki_miktar IS NOT NULL
      ORDER BY sth_stok_kod
    `);

    console.log(`   ${testData.length} kayıt test edilecek`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of testData) {
      try {
        const result = await eldekiMiktarProcessor.updateSingleStokEldekiMiktar(
          row.stok_kodu,
          row.eldeki_miktar
        );
        if (result) successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    console.log(`   ✓ Başarılı: ${successCount}`);
    console.log(`   ✗ Hatalı: ${errorCount}`);

    console.log();

    // 5. Doğrulama
    console.log('5. Doğrulama...');
    const updatedCount = await pgService.query(`
      SELECT COUNT(*) as count 
      FROM stoklar 
      WHERE eldeki_miktar IS NOT NULL 
        AND eldeki_miktar > 0
    `);
    console.log(`   Güncellenen stok sayısı: ${updatedCount[0].count}`);

    // Örnek kayıtları göster
    const samples = await pgService.query(`
      SELECT stok_kodu, stok_adi, eldeki_miktar
      FROM stoklar
      WHERE eldeki_miktar IS NOT NULL 
        AND eldeki_miktar > 0
      ORDER BY guncelleme_tarihi DESC
      LIMIT 5
    `);

    if (samples.length > 0) {
      console.log('\n   Örnek güncellenmiş kayıtlar:');
      samples.forEach(s => {
        console.log(`   - ${s.stok_kodu}: ${s.eldeki_miktar} (${s.stok_adi})`);
      });
    }

    console.log();
    console.log('='.repeat(70));
    console.log('✓ TEST TAMAMLANDI!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error();
    console.error('='.repeat(70));
    console.error('✗ TEST BAŞARISIZ!');
    console.error('='.repeat(70));
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mssqlService.disconnect();
    await pgService.disconnect();
    process.exit(0);
  }
}

testEldekiMiktar();
