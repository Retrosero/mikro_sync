require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function fixMissingMapping() {
  try {
    const cariId = 'db2a3f57-015a-41cf-b846-4801e301a96d';
    const erpKod = 'PKR-MY HOME';
    
    console.log('Eksik mapping ekleniyor...\n');
    
    // Önce bu ERP kodu başka bir web cari'sine eşleşmiş mi kontrol et
    const existing = await pgService.queryOne(`
      SELECT web_cari_id, erp_cari_kod
      FROM int_kodmap_cari
      WHERE erp_cari_kod = $1
    `, [erpKod]);
    
    if (existing) {
      console.log(`⚠ ${erpKod} zaten ${existing.web_cari_id} ile eşleşmiş`);
      console.log('Bu mapping silinip yenisi oluşturulacak...\n');
      
      await pgService.query(`
        DELETE FROM int_kodmap_cari WHERE erp_cari_kod = $1
      `, [erpKod]);
      
      console.log('✓ Eski mapping silindi');
    }
    
    // Yeni mapping ekle
    await pgService.query(`
      INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod, created_at)
      VALUES ($1, $2, NOW())
    `, [cariId, erpKod]);
    
    console.log(`✓ Yeni mapping eklendi: ${cariId} → ${erpKod}`);
    
    // Doğrula
    const check = await pgService.queryOne(`
      SELECT * FROM int_kodmap_cari WHERE web_cari_id = $1
    `, [cariId]);
    
    console.log('\nDoğrulama:');
    console.log(check);

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await pgService.disconnect();
    process.exit(0);
  }
}

fixMissingMapping();
