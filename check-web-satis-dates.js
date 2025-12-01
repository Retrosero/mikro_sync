require('dotenv').config();
const { Pool } = require('pg');

async function checkWebSatisDates() {
  const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
  });
  
  try {
    
    // Son satışı kontrol et
    const result = await pool.query(`
      SELECT 
        id,
        satis_no,
        olusturma_tarihi,
        guncelleme_tarihi,
        satis_tarihi
      FROM satislar
      ORDER BY olusturma_tarihi DESC
      LIMIT 5
    `);
    
    console.log('Son 5 satış:');
    result.rows.forEach(satis => {
      console.log('\n---');
      console.log('ID:', satis.id);
      console.log('Satış No:', satis.satis_no);
      console.log('Oluşturma Tarihi:', satis.olusturma_tarihi);
      console.log('Güncelleme Tarihi:', satis.guncelleme_tarihi);
      console.log('Satış Tarihi:', satis.satis_tarihi);
    });
    
    await pool.end();
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

checkWebSatisDates();
