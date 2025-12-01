require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function fixSpecificCariMapping() {
    try {
        console.log('Problematik Cari ID için Mapping Oluşturma...');
        console.log('='.repeat(70));

        const problematicId = 'df1ebbaa-878f-4a26-a083-7975ac1be96d';

        // Bu ID'nin cari bilgisini al
        const cari = await pgService.query(`
      SELECT id, cari_kodu, cari_adi
      FROM cari_hesaplar
      WHERE id = $1
    `, [problematicId]);

        if (cari.length === 0) {
            console.log(`⚠ Cari bulunamadı: ${problematicId}`);
            console.log('Bu ID eski bir kayıt olabilir. Satışları kontrol ediyorum...\n');

            // Bu ID'yi kullanan satışları bul
            const sales = await pgService.query(`
        SELECT id, satis_tarihi, cari_hesap_id, toplam_tutar
        FROM satislar
        WHERE cari_hesap_id = $1
        ORDER BY satis_tarihi DESC
        LIMIT 5
      `, [problematicId]);

            console.log(`${sales.length} satış bulundu bu ID ile:`);
            sales.forEach(s => {
                console.log(`  - Satış: ${s.id}, Tarih: ${s.satis_tarihi}, Tutar: ${s.toplam_tutar}`);
            });

            // Bu satışları güncel SERHAN ID'si ile güncelle
            const serhan = await pgService.query(`
        SELECT id, cari_kodu, cari_adi
        FROM cari_hesaplar
        WHERE cari_kodu = 'SERHAN'
        LIMIT 1
      `);

            if (serhan.length > 0) {
                console.log(`\n✓ SERHAN bulundu: ${serhan[0].cari_adi} (${serhan[0].id})`);
                console.log('Satışları güncelliyorum...\n');

                const result = await pgService.query(`
          UPDATE satislar
          SET cari_hesap_id = $1
          WHERE cari_hesap_id = $2
          RETURNING id
        `, [serhan[0].id, problematicId]);

                console.log(`✓ ${result.length} satış güncellendi`);

                // Mapping'i de oluştur
                await pgService.query(`
          INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
          VALUES ($1, $2)
          ON CONFLICT (web_cari_id) DO UPDATE SET erp_cari_kod = $2
        `, [serhan[0].id, serhan[0].cari_kodu]);

                console.log(`✓ Mapping oluşturuldu: ${serhan[0].id} -> ${serhan[0].cari_kodu}`);
            }
        } else {
            console.log(`✓ Cari bulundu: ${cari[0].cari_adi} (${cari[0].cari_kodu})`);

            // Mapping oluştur
            await pgService.query(`
        INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
        VALUES ($1, $2)
        ON CONFLICT (web_cari_id) DO UPDATE SET erp_cari_kod = $2
      `, [cari[0].id, cari[0].cari_kodu]);

            console.log(`✓ Mapping oluşturuldu: ${cari[0].id} -> ${cari[0].cari_kodu}`);
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('✗ Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

fixSpecificCariMapping();
