require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function fixAllMappings() {
    try {
        console.log('Tüm Eksik Cari Mapping\'ler Oluşturuluyor...');
        console.log('='.repeat(70));

        // Pending satışları al
        const pendingSales = await pgService.query(`
      SELECT sq.entity_id, s.cari_hesap_id
      FROM sync_queue sq
      JOIN satislar s ON s.id = sq.entity_id
      WHERE sq.entity_type = 'satis' AND sq.status = 'pending'
    `);

        console.log(`${pendingSales.length} pending satış bulundu`);

        for (const sale of pendingSales) {
            // Cari bilgisini al
            const cari = await pgService.query(`
        SELECT id, cari_kodu, cari_adi
        FROM cari_hesaplar
        WHERE id = $1
      `, [sale.cari_hesap_id]);

            if (cari.length === 0) {
                console.log(`⚠ Cari bulunamadı: ${sale.cari_hesap_id}`);
                continue;
            }

            const cariData = cari[0];
            console.log(`\n✓ Cari: ${cariData.cari_adi} (${cariData.cari_kodu})`);

            // Mapping var mı kontrol et
            const existingMapping = await pgService.query(`
        SELECT * FROM int_kodmap_cari 
        WHERE web_cari_id = $1
      `, [cariData.id]);

            if (existingMapping.length === 0) {
                // Mapping oluştur
                await pgService.query(`
          INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
          VALUES ($1, $2)
          ON CONFLICT (web_cari_id) DO UPDATE SET erp_cari_kod = $2
        `, [cariData.id, cariData.cari_kodu]);

                console.log(`  ✓ Mapping oluşturuldu: ${cariData.id} -> ${cariData.cari_kodu}`);
            } else {
                console.log(`  ✓ Mapping zaten mevcut`);
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('✓ Tüm mapping\'ler hazır!');

    } catch (error) {
        console.error('✗ Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

fixAllMappings();
