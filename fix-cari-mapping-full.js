require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function fixCariMappingFull() {
  try {
    console.log('='.repeat(70));
    console.log('CARİ MAPPING TAM GÜNCELLEME');
    console.log('='.repeat(70));
    console.log();

    // 1. ERP ve Web carilerini al
    console.log('1. Cariler alınıyor...');
    
    const erpCariler = await mssqlService.query(`
      SELECT cari_kod, cari_unvan1 
      FROM CARI_HESAPLAR
      ORDER BY cari_kod
    `);
    
    const webCariler = await pgService.query(`
      SELECT id, cari_kodu, cari_adi
      FROM cari_hesaplar
      ORDER BY cari_kodu
    `);

    console.log(`   ERP Cariler: ${erpCariler.length}`);
    console.log(`   Web Cariler: ${webCariler.length}`);
    console.log();

    // 2. Mevcut mapping'leri al
    console.log('2. Mevcut mapping\'ler kontrol ediliyor...');
    
    const mevcutMappings = await pgService.query(`
      SELECT web_cari_id, erp_cari_kod
      FROM int_kodmap_cari
    `);

    console.log(`   Mevcut mapping: ${mevcutMappings.length}`);
    console.log();

    // 3. Web carilerini map'e çevir
    const webCariMap = new Map();
    webCariler.forEach(c => {
      webCariMap.set(c.cari_kodu, c);
    });

    // 4. Mevcut mapping'leri map'e çevir
    const mappingMap = new Map();
    mevcutMappings.forEach(m => {
      mappingMap.set(m.web_cari_id, m.erp_cari_kod);
    });

    // 5. Eksik mapping'leri bul ve ekle
    console.log('3. Eksik mapping\'ler ekleniyor...');
    
    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const erpCari of erpCariler) {
      try {
        const webCari = webCariMap.get(erpCari.cari_kod);
        
        if (!webCari) {
          // Web'de bu cari yok, atla
          continue;
        }

        // Mapping var mı kontrol et
        if (mappingMap.has(webCari.id)) {
          skippedCount++;
          continue;
        }

        // Mapping ekle (hem web_cari_id hem de erp_cari_kod unique olduğu için kontrol et)
        const existingByErpKod = await pgService.queryOne(`
          SELECT web_cari_id FROM int_kodmap_cari WHERE erp_cari_kod = $1
        `, [erpCari.cari_kod]);

        if (existingByErpKod) {
          // Bu ERP kodu başka bir web cari'sine eşleşmiş
          console.log(`   ⚠ ${erpCari.cari_kod} zaten ${existingByErpKod.web_cari_id} ile eşleşmiş`);
          skippedCount++;
          continue;
        }

        await pgService.query(`
          INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod, created_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (web_cari_id) DO NOTHING
        `, [webCari.id, erpCari.cari_kod]);

        console.log(`   ✓ ${erpCari.cari_kod} → ${webCari.id}`);
        addedCount++;

      } catch (error) {
        console.error(`   ✗ Hata (${erpCari.cari_kod}): ${error.message}`);
        errorCount++;
      }
    }

    console.log();
    console.log('-'.repeat(70));
    console.log(`Eklenen: ${addedCount}, Atlanan: ${skippedCount}, Hata: ${errorCount}`);
    console.log('-'.repeat(70));
    console.log();

    // 6. Doğrulama
    console.log('4. Doğrulama yapılıyor...');
    
    const toplamMapping = await pgService.query(`
      SELECT COUNT(*) as count FROM int_kodmap_cari
    `);

    console.log(`   Toplam mapping: ${toplamMapping[0].count}`);
    
    // Eksik mapping kontrolü
    const eksikMapping = await pgService.query(`
      SELECT COUNT(*) as count
      FROM cari_hesaplar c
      WHERE NOT EXISTS (
        SELECT 1 FROM int_kodmap_cari m WHERE m.web_cari_id = c.id
      )
    `);

    if (eksikMapping[0].count === 0) {
      console.log('   ✓ Tüm cariler eşleştirildi!');
    } else {
      console.log(`   ⚠ ${eksikMapping[0].count} cari için mapping eksik`);
    }

    console.log();
    console.log('='.repeat(70));
    console.log('✓ İŞLEM TAMAMLANDI');
    console.log('='.repeat(70));

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

fixCariMappingFull();
