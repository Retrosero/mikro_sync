require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function createFiyatListeMappings() {
  try {
    console.log('Fiyat Liste Mapping Oluşturuluyor...\n');

    // 1. ERP'deki fiyat listelerini al
    console.log('1. ERP fiyat listeleri kontrol ediliyor...');
    const erpFiyatListeleri = await mssqlService.query(`
      SELECT DISTINCT sfiyat_listesirano
      FROM STOK_SATIS_FIYAT_LISTELERI
      WHERE sfiyat_fiyati > 0
      ORDER BY sfiyat_listesirano
    `);

    console.log(`   ${erpFiyatListeleri.length} farklı fiyat listesi bulundu:`);
    erpFiyatListeleri.forEach(liste => {
      console.log(`   - Liste No: ${liste.sfiyat_listesirano}`);
    });

    console.log();

    // 2. Web'deki fiyat tanımlarını al
    console.log('2. Web fiyat tanımları kontrol ediliyor...');
    const webFiyatTanimlari = await pgService.query(`
      SELECT id, fiyat_adi, aciklama
      FROM fiyat_tanimlari
      ORDER BY id
    `);

    console.log(`   ${webFiyatTanimlari.length} fiyat tanımı bulundu:`);
    webFiyatTanimlari.forEach(tanim => {
      console.log(`   - ID: ${tanim.id}, Adı: ${tanim.fiyat_adi}`);
    });

    console.log();

    // 3. Eğer Web'de fiyat tanımı yoksa oluştur
    if (webFiyatTanimlari.length === 0) {
      console.log('3. Web\'de fiyat tanımı bulunamadı, oluşturuluyor...');
      
      for (const erpListe of erpFiyatListeleri) {
        const listeNo = erpListe.sfiyat_listesirano;
        const fiyatAdi = `Fiyat Listesi ${listeNo}`;
        
        const result = await pgService.queryOne(`
          INSERT INTO fiyat_tanimlari (fiyat_adi, aciklama, aktif)
          VALUES ($1, $2, true)
          RETURNING id
        `, [fiyatAdi, `ERP Liste No: ${listeNo}`]);

        console.log(`   ✓ Oluşturuldu: ${fiyatAdi} (ID: ${result.id})`);
        webFiyatTanimlari.push({ id: result.id, fiyat_adi: fiyatAdi });
      }
      console.log();
    }

    // 4. Mapping'leri oluştur
    console.log('4. Fiyat liste mapping\'leri oluşturuluyor...');
    
    // Mevcut mapping'leri kontrol et
    const existingMappings = await pgService.query('SELECT * FROM int_kodmap_fiyat_liste');
    console.log(`   Mevcut mapping sayısı: ${existingMappings.length}`);

    let createdCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < erpFiyatListeleri.length && i < webFiyatTanimlari.length; i++) {
      const erpListeNo = erpFiyatListeleri[i].sfiyat_listesirano;
      const webFiyatTanimId = webFiyatTanimlari[i].id;

      // Mapping var mı kontrol et
      const existing = await pgService.queryOne(
        'SELECT * FROM int_kodmap_fiyat_liste WHERE erp_liste_no = $1',
        [erpListeNo]
      );

      if (existing) {
        console.log(`   ⊘ Zaten var: ERP Liste ${erpListeNo} → Web ID ${existing.web_fiyat_tanimi_id}`);
        skippedCount++;
      } else {
        await pgService.query(`
          INSERT INTO int_kodmap_fiyat_liste (erp_liste_no, web_fiyat_tanimi_id)
          VALUES ($1, $2)
        `, [erpListeNo, webFiyatTanimId]);

        console.log(`   ✓ Oluşturuldu: ERP Liste ${erpListeNo} → Web ID ${webFiyatTanimId}`);
        createdCount++;
      }
    }

    console.log();
    console.log('='.repeat(60));
    console.log(`✓ İşlem tamamlandı!`);
    console.log(`  Oluşturulan: ${createdCount}`);
    console.log(`  Atlanan: ${skippedCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgService.disconnect();
    await mssqlService.disconnect();
    process.exit(0);
  }
}

createFiyatListeMappings();
