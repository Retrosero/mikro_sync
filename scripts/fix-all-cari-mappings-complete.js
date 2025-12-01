require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function fixAllCariMappings() {
    try {
        console.log('Tüm Cari Mapping\'leri Düzeltme...');
        console.log('='.repeat(70));

        // Tüm cari hesapları al
        const allCari = await pgService.query(`
      SELECT id, cari_kodu, cari_adi
      FROM cari_hesaplar
      WHERE cari_kodu IS NOT NULL AND cari_kodu != ''
    `);

        console.log(`${allCari.length} cari hesap bulundu\n`);

        let created = 0;
        let existing = 0;

        for (const cari of allCari) {
            // Mapping var mı kontrol et
            const existingMapping = await pgService.query(`
        SELECT * FROM int_kodmap_cari 
        WHERE web_cari_id = $1
      `, [cari.id]);

            if (existingMapping.length === 0) {
                // Mapping oluştur
                await pgService.query(`
          INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
          VALUES ($1, $2)
          ON CONFLICT (web_cari_id) DO UPDATE SET erp_cari_kod = $2
        `, [cari.id, cari.cari_kodu]);

                console.log(`✓ Mapping oluşturuldu: ${cari.cari_adi} (${cari.cari_kodu})`);
                created++;
            } else {
                existing++;
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log(`✓ Tamamlandı!`);
        console.log(`  Oluşturulan: ${created}`);
        console.log(`  Mevcut: ${existing}`);
        console.log(`  Toplam: ${allCari.length}`);

    } catch (error) {
        console.error('✗ Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

fixAllCariMappings();
