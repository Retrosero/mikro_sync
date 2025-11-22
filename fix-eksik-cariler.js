require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function fixEksikCariler() {
  try {
    console.log('='.repeat(70));
    console.log('EKSİK CARİLERİ DÜZELTME');
    console.log('='.repeat(70));
    console.log();

    // 1. Eksik carileri bul
    console.log('1. Eksik cariler tespit ediliyor...');
    
    const eksikCariler = await mssqlService.query(`
      SELECT DISTINCT 
        ch.cha_kod as cari_kod,
        COUNT(*) as hareket_sayisi
      FROM CARI_HESAP_HAREKETLERI ch
      WHERE ch.cha_kod NOT IN (
        SELECT cari_kod FROM CARI_HESAPLAR
      )
      GROUP BY ch.cha_kod
      ORDER BY hareket_sayisi DESC
    `);

    console.log(`   Bulunan eksik cari: ${eksikCariler.length}`);
    
    if (eksikCariler.length === 0) {
      console.log('   ✓ Eksik cari yok!');
      return;
    }

    console.log('\n   Eksik cariler:');
    eksikCariler.forEach(c => {
      console.log(`   - ${c.cari_kod}: ${c.hareket_sayisi} hareket`);
    });

    console.log();

    // 2. Trigger'ları geçici olarak devre dışı bırak
    console.log('2. Trigger\'lar devre dışı bırakılıyor...');
    try {
      await pgService.query('ALTER TABLE cari_hesaplar DISABLE TRIGGER ALL');
      console.log('   ✓ Trigger\'lar devre dışı');
    } catch (e) {
      console.log('   ⚠ Trigger devre dışı bırakılamadı:', e.message);
    }

    console.log();

    // 3. Web'de bu carileri oluştur
    console.log('3. Eksik cariler Web\'e ekleniyor...');
    
    let addedCount = 0;
    let errorCount = 0;

    for (const cari of eksikCariler) {
      try {
        // Cari adını oluştur
        const cariAdi = `[Otomatik] Cari ${cari.cari_kod}`;
        
        // Web'de var mı kontrol et
        const existing = await pgService.queryOne(
          'SELECT id FROM cari_hesaplar WHERE cari_kodu = $1',
          [cari.cari_kod]
        );

        if (existing) {
          console.log(`   ⊘ Zaten var: ${cari.cari_kod}`);
          continue;
        }

        // Yeni cari ekle
        await pgService.query(`
          INSERT INTO cari_hesaplar (
            cari_kodu, 
            cari_adi, 
            telefon, 
            eposta, 
            vergi_dairesi, 
            vergi_no,
            olusturma_tarihi,
            guncelleme_tarihi
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, [
          cari.cari_kod,
          cariAdi,
          null,
          null,
          null,
          null
        ]);

        console.log(`   ✓ Eklendi: ${cari.cari_kod} - ${cariAdi}`);
        addedCount++;

      } catch (error) {
        console.error(`   ✗ Hata (${cari.cari_kod}): ${error.message}`);
        errorCount++;
      }
    }

    console.log();
    console.log('-'.repeat(70));
    console.log(`Eklenen: ${addedCount}, Hata: ${errorCount}`);
    console.log('-'.repeat(70));

    console.log();

    // 4. Trigger'ları tekrar etkinleştir
    console.log('4. Trigger\'lar etkinleştiriliyor...');
    try {
      await pgService.query('ALTER TABLE cari_hesaplar ENABLE TRIGGER ALL');
      console.log('   ✓ Trigger\'lar etkinleştirildi');
    } catch (e) {
      console.log('   ⚠ Trigger etkinleştirilemedi:', e.message);
    }

    console.log();

    // 5. Doğrulama
    console.log('5. Doğrulama yapılıyor...');
    
    const kalanEksik = await mssqlService.query(`
      SELECT COUNT(*) as count
      FROM CARI_HESAP_HAREKETLERI ch
      WHERE ch.cha_kod NOT IN (
        SELECT cari_kod FROM CARI_HESAPLAR
      )
    `);

    if (kalanEksik[0].count === 0) {
      console.log('   ✓ Tüm eksik cariler düzeltildi!');
    } else {
      console.log(`   ⚠ Hala ${kalanEksik[0].count} eksik cari var`);
    }

    // Web'deki toplam cari sayısı
    const webCariCount = await pgService.query('SELECT COUNT(*) as count FROM cari_hesaplar');
    console.log(`   Web'deki toplam cari: ${webCariCount[0].count}`);

    console.log();
    console.log('='.repeat(70));
    console.log('✓ İŞLEM TAMAMLANDI');
    console.log('='.repeat(70));
    console.log();
    console.log('NOT: Eklenen cariler "[Otomatik]" ön eki ile işaretlenmiştir.');
    console.log('     ERP\'de bu carilerin gerçek bilgilerini bulup güncelleyebilirsiniz.');

  } catch (error) {
    console.error();
    console.error('='.repeat(70));
    console.error('✗ İŞLEM BAŞARISIZ!');
    console.error('='.repeat(70));
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mssqlService.disconnect();
    await pgService.disconnect();
    process.exit(0);
  }
}

fixEksikCariler();
