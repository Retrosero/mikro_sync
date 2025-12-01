require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function fixCariMapping() {
  try {
    console.log('Cari mapping\'ler kontrol ediliyor ve oluşturuluyor...\n');

    // Tüm carileri al
    const cariler = await pgService.query(`
      SELECT id, cari_kodu, cari_adi 
      FROM cari_hesaplar 
      WHERE cari_kodu IS NOT NULL
      ORDER BY cari_kodu
    `);

    console.log(`${cariler.length} cari bulundu\n`);

    let created = 0;
    let existing = 0;

    for (const cari of cariler) {
      // Mapping var mı kontrol et
      const mapping = await pgService.queryOne(`
        SELECT * FROM int_kodmap_cari WHERE web_cari_id = $1
      `, [cari.id]);

      if (!mapping) {
        // ERP kod ile mapping var mı kontrol et
        const erpMapping = await pgService.queryOne(`
          SELECT * FROM int_kodmap_cari WHERE erp_cari_kod = $1
        `, [cari.cari_kodu]);

        if (erpMapping) {
          console.log(`⊘ Atlandı (ERP kod zaten kullanılıyor): ${cari.cari_kodu} - ${cari.cari_adi}`);
          existing++;
        } else {
          // Mapping oluştur
          await pgService.query(`
            INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
            VALUES ($1, $2)
          `, [cari.id, cari.cari_kodu]);
          
          console.log(`✓ Oluşturuldu: ${cari.cari_kodu} - ${cari.cari_adi}`);
          created++;
        }
      } else {
        existing++;
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`Toplam: ${cariler.length}`);
    console.log(`Oluşturulan: ${created}`);
    console.log(`Mevcut: ${existing}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await pgService.disconnect();
  }
}

fixCariMapping();
