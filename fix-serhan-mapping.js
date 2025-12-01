require('dotenv').config();
const { Pool } = require('pg');

async function fixSerhanMapping() {
  const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
  });

  try {
    console.log('SERHAN mapping düzeltiliyor...\n');

    // SERHAN müşterisini bul
    const webCari = await pool.query(`
      SELECT id, cari_kodu, cari_adi
      FROM cari_hesaplar
      WHERE cari_kodu = 'SERHAN'
    `);

    if (webCari.rows.length === 0) {
      console.error('✗ SERHAN müşterisi web\'de bulunamadı!');
      return;
    }

    console.log('✓ Web\'de bulundu:', webCari.rows[0].cari_adi);
    console.log('  ID:', webCari.rows[0].id);
    console.log('  Kod:', webCari.rows[0].cari_kodu);

    // Eski mapping'i sil
    const deleted = await pool.query(`
      DELETE FROM int_kodmap_cari
      WHERE erp_cari_kod = 'SERHAN'
      RETURNING *
    `);

    if (deleted.rows.length > 0) {
      console.log('\n✓ Eski mapping silindi');
    }

    // Yeni mapping oluştur
    await pool.query(`
      INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
      VALUES ($1, $2)
    `, [webCari.rows[0].id, 'SERHAN']);

    console.log('✓ Yeni mapping oluşturuldu: SERHAN');

    await pool.end();
    console.log('\n✓ İşlem tamamlandı!');

  } catch (error) {
    console.error('✗ Hata:', error.message);
    process.exit(1);
  }
}

fixSerhanMapping();
