require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function testCariEslestirme() {
  try {
    console.log('='.repeat(70));
    console.log('CARİ EŞLEŞTIRME KONTROLÜ');
    console.log('='.repeat(70));
    console.log();

    // 1. ERP'deki Cari Sayısı
    console.log('1. ERP Cari Hesaplar...');
    const erpCariCount = await mssqlService.query(`
      SELECT COUNT(*) as count FROM CARI_HESAPLAR
    `);
    console.log(`   Toplam: ${erpCariCount[0].count} cari`);

    // Örnek cariler
    const erpCariSample = await mssqlService.query(`
      SELECT TOP 5 cari_kod, cari_unvan1 
      FROM CARI_HESAPLAR 
      ORDER BY cari_kod
    `);
    console.log('   Örnek cariler:');
    erpCariSample.forEach(c => {
      console.log(`   - ${c.cari_kod}: ${c.cari_unvan1}`);
    });

    console.log();

    // 2. Web'deki Cari Sayısı
    console.log('2. Web Cari Hesaplar...');
    const webCariCount = await pgService.query(`
      SELECT COUNT(*) as count FROM cari_hesaplar
    `);
    console.log(`   Toplam: ${webCariCount[0].count} cari`);

    // Örnek cariler
    const webCariSample = await pgService.query(`
      SELECT cari_kodu, cari_adi 
      FROM cari_hesaplar 
      ORDER BY cari_kodu 
      LIMIT 5
    `);
    console.log('   Örnek cariler:');
    webCariSample.forEach(c => {
      console.log(`   - ${c.cari_kodu}: ${c.cari_adi}`);
    });

    console.log();

    // 3. Cari Hareket Kontrolü
    console.log('3. Cari Hareket Eşleştirme Kontrolü...');
    
    // ERP'deki cari hareketlerde kullanılan cariler
    const erpCariHareketCari = await mssqlService.query(`
      SELECT DISTINCT cha_kod, COUNT(*) as hareket_sayisi
      FROM CARI_HESAP_HAREKETLERI
      GROUP BY cha_kod
      ORDER BY hareket_sayisi DESC
    `);
    console.log(`   ERP'de hareket olan cari sayısı: ${erpCariHareketCari.length}`);

    // Web'de eşleşmeyen cariler
    const unmatchedCariHareket = await pgService.query(`
      SELECT DISTINCT ch.cari_kodu, COUNT(*) as hareket_sayisi
      FROM cari_hesap_hareketleri chh
      LEFT JOIN cari_hesaplar ch ON ch.id = chh.cari_hesap_id
      WHERE ch.id IS NULL
      GROUP BY ch.cari_kodu
    `);
    
    if (unmatchedCariHareket.length > 0) {
      console.log(`   ⚠ Web'de eşleşmeyen cari hareket: ${unmatchedCariHareket.length}`);
    } else {
      console.log(`   ✓ Tüm cari hareketler eşleşiyor`);
    }

    // Örnek eşleşmeyen cariler (varsa)
    const sampleUnmatched = await mssqlService.query(`
      SELECT TOP 10 
        cha_kod,
        COUNT(*) as hareket_sayisi
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_kod NOT IN (
        SELECT cari_kod FROM CARI_HESAPLAR
      )
      GROUP BY cha_kod
      ORDER BY hareket_sayisi DESC
    `);

    if (sampleUnmatched.length > 0) {
      console.log('\n   ⚠ ERP\'de hareket var ama cari tanımı yok:');
      sampleUnmatched.forEach(c => {
        console.log(`   - ${c.cha_kod}: ${c.hareket_sayisi} hareket`);
      });
    }

    console.log();

    // 4. Stok Hareket Kontrolü
    console.log('4. Stok Hareket Eşleştirme Kontrolü...');
    
    // ERP'deki stok hareketlerde kullanılan cariler
    const erpStokHareketCari = await mssqlService.query(`
      SELECT DISTINCT sth_cari_kodu, COUNT(*) as hareket_sayisi
      FROM STOK_HAREKETLERI
      WHERE sth_cari_kodu IS NOT NULL AND sth_cari_kodu != ''
      GROUP BY sth_cari_kodu
      ORDER BY hareket_sayisi DESC
    `);
    console.log(`   ERP'de stok hareket olan cari sayısı: ${erpStokHareketCari.length}`);

    // Örnek eşleşmeyen cariler (stok hareket)
    const sampleUnmatchedStok = await mssqlService.query(`
      SELECT TOP 10 
        sth_cari_kodu,
        COUNT(*) as hareket_sayisi
      FROM STOK_HAREKETLERI
      WHERE sth_cari_kodu IS NOT NULL 
        AND sth_cari_kodu != ''
        AND sth_cari_kodu NOT IN (
          SELECT cari_kod FROM CARI_HESAPLAR
        )
      GROUP BY sth_cari_kodu
      ORDER BY hareket_sayisi DESC
    `);

    if (sampleUnmatchedStok.length > 0) {
      console.log('\n   ⚠ ERP\'de stok hareket var ama cari tanımı yok:');
      sampleUnmatchedStok.forEach(c => {
        console.log(`   - ${c.sth_cari_kodu}: ${c.hareket_sayisi} hareket`);
      });
    } else {
      console.log('   ✓ Tüm stok hareketlerdeki cariler tanımlı');
    }

    console.log();

    // 5. Web'de Eksik Cariler
    console.log('5. Web\'de Eksik Cari Kontrolü...');
    
    // Cari hareket için gerekli ama web'de olmayan cariler
    const missingCariForHareket = await mssqlService.query(`
      SELECT DISTINCT 
        ch.cha_kod,
        c.cari_unvan1,
        COUNT(*) as hareket_sayisi
      FROM CARI_HESAP_HAREKETLERI ch
      LEFT JOIN CARI_HESAPLAR c ON c.cari_kod = ch.cha_kod
      WHERE ch.cha_kod NOT IN (
        SELECT cari_kod FROM CARI_HESAPLAR
      )
      GROUP BY ch.cha_kod, c.cari_unvan1
      ORDER BY hareket_sayisi DESC
    `);

    if (missingCariForHareket.length > 0) {
      console.log(`   ⚠ Cari hareket için eksik cari: ${missingCariForHareket.length}`);
      console.log('\n   İlk 10 eksik cari:');
      missingCariForHareket.slice(0, 10).forEach(c => {
        console.log(`   - ${c.cha_kod}: ${c.hareket_sayisi} hareket`);
      });
    } else {
      console.log('   ✓ Eksik cari yok');
    }

    console.log();

    // 6. Çözüm Önerileri
    console.log('6. Çözüm Önerileri...');
    console.log('-'.repeat(70));
    
    if (sampleUnmatched.length > 0 || sampleUnmatchedStok.length > 0) {
      console.log('\n   ⚠ SORUN TESPİT EDİLDİ:');
      console.log('   ERP\'de bazı hareketlerde kullanılan cari kodları');
      console.log('   CARI_HESAPLAR tablosunda tanımlı değil.');
      console.log();
      console.log('   ÇÖZÜM:');
      console.log('   1. ERP\'de bu cari kodlarını kontrol edin');
      console.log('   2. Silinmiş veya pasif cariler olabilir');
      console.log('   3. Cari senkronizasyonunda filtre eklenebilir');
      console.log('   4. Veya bu carileri manuel olarak ekleyin');
    } else {
      console.log('   ✓ Sorun tespit edilmedi');
      console.log('   ✓ Tüm cariler düzgün eşleşiyor');
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
    await mssqlService.disconnect();
    await pgService.disconnect();
    process.exit(0);
  }
}

testCariEslestirme();
