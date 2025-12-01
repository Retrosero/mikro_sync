require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function fixAcilMapping() {
  try {
    console.log('ACİL müşterisi mapping düzeltiliyor...\n');
    
    // ACİL müşterisini bul
    const acilCari = await pgService.queryOne(`
      SELECT id, cari_kodu, cari_adi
      FROM cari_hesaplar
      WHERE cari_kodu = 'ACİL'
    `);

    if (!acilCari) {
      console.log('ACİL müşterisi bulunamadı!');
      return;
    }

    console.log(`Müşteri: ${acilCari.cari_adi} (${acilCari.cari_kodu})`);
    console.log(`Web ID: ${acilCari.id}\n`);

    // Mevcut mapping var mı?
    const mevcutMapping = await pgService.queryOne(`
      SELECT * FROM int_kodmap_cari WHERE web_cari_id = $1
    `, [acilCari.id]);

    if (mevcutMapping) {
      console.log('✓ Mapping zaten var:');
      console.log(`  Web ID: ${mevcutMapping.web_cari_id}`);
      console.log(`  ERP Kod: ${mevcutMapping.erp_cari_kod}`);
      return;
    }

    // ERP koduna göre başka mapping var mı?
    const erpMapping = await pgService.queryOne(`
      SELECT * FROM int_kodmap_cari WHERE erp_cari_kod = $1
    `, [acilCari.cari_kodu]);

    if (erpMapping) {
      console.log(`⚠ ${acilCari.cari_kodu} zaten ${erpMapping.web_cari_id} ile eşleşmiş`);
      console.log('Eski mapping siliniyor...\n');
      
      await pgService.query(`
        DELETE FROM int_kodmap_cari WHERE erp_cari_kod = $1
      `, [acilCari.cari_kodu]);
    }

    // Yeni mapping ekle
    await pgService.query(`
      INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod, created_at)
      VALUES ($1, $2, NOW())
    `, [acilCari.id, acilCari.cari_kodu]);

    console.log('✓ Yeni mapping eklendi:');
    console.log(`  Web ID: ${acilCari.id}`);
    console.log(`  ERP Kod: ${acilCari.cari_kodu}`);

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await pgService.disconnect();
    process.exit(0);
  }
}

fixAcilMapping();
