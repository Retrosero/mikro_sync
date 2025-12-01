require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function analyzeDuplicateCariler() {
  try {
    console.log('='.repeat(70));
    console.log('DUPLICATE CARİ ANALİZİ');
    console.log('='.repeat(70));
    console.log();

    // Aynı cari_kodu'na sahip birden fazla kayıt var mı?
    const duplicates = await pgService.query(`
      SELECT 
        cari_kodu,
        COUNT(*) as kayit_sayisi,
        STRING_AGG(id::text, ', ') as id_listesi,
        STRING_AGG(cari_adi, ' | ') as ad_listesi
      FROM cari_hesaplar
      GROUP BY cari_kodu
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);

    console.log(`Duplicate cari kodu sayısı: ${duplicates.length}\n`);

    if (duplicates.length > 0) {
      console.log('İlk 20 duplicate:');
      duplicates.slice(0, 20).forEach(d => {
        console.log(`\n  ${d.cari_kodu}: ${d.kayit_sayisi} kayıt`);
        console.log(`    IDs: ${d.id_listesi}`);
        console.log(`    Adlar: ${d.ad_listesi}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✓ ANALİZ TAMAMLANDI');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await pgService.disconnect();
    process.exit(0);
  }
}

analyzeDuplicateCariler();
