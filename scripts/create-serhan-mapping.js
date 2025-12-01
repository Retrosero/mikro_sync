require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function createSERHANMapping() {
    try {
        console.log('SERHAN Cari Mapping Oluşturuluyor...');
        console.log('='.repeat(70));

        // 1. SERHAN cari ID'sini bul
        const cariResult = await pgService.query(`
      SELECT id, cari_kodu, cari_adi 
      FROM cari_hesaplar 
      WHERE cari_kodu = 'SERHAN'
      LIMIT 1
    `);

        if (cariResult.length === 0) {
            throw new Error('SERHAN müşterisi bulunamadı!');
        }

        const cari = cariResult[0];
        console.log(`✓ Cari bulundu: ${cari.cari_adi} (${cari.cari_kodu})`);

        // 2. Mapping var mı kontrol et
        const existingMapping = await pgService.query(`
      SELECT * FROM int_kodmap_cari 
      WHERE web_cari_id = $1 OR erp_cari_kod = $2
    `, [cari.id, cari.cari_kodu]);

        if (existingMapping.length > 0) {
            console.log('✓ Mapping zaten mevcut');
            console.log(`  Web ID: ${existingMapping[0].web_cari_id}`);
            console.log(`  ERP Kod: ${existingMapping[0].erp_cari_kod}`);
        } else {
            // 3. Mapping oluştur
            await pgService.query(`
        INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
        VALUES ($1, $2)
      `, [cari.id, cari.cari_kodu]);

            console.log('✓ Mapping oluşturuldu');
            console.log(`  Web ID: ${cari.id}`);
            console.log(`  ERP Kod: ${cari.cari_kodu}`);
        }

        console.log('='.repeat(70));

    } catch (error) {
        console.error('✗ Hata:', error.message);
        throw error;
    } finally {
        await pgService.disconnect();
    }
}

createSERHANMapping();
