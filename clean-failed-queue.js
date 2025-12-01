require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function cleanFailedQueue() {
  try {
    console.log('Başarısız sync_queue kayıtları temizleniyor...\n');
    
    // Önce durumu göster
    const before = await pgService.query(`
      SELECT status, COUNT(*) as count 
      FROM sync_queue 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    console.log('Önceki Durum:');
    before.forEach(r => {
      console.log(`  ${r.status}: ${r.count}`);
    });
    
    // Başarısız kayıtları sil
    const result = await pgService.query(`
      DELETE FROM sync_queue 
      WHERE status = 'failed'
    `);
    
    console.log(`\n✓ ${result.rowCount || 0} başarısız kayıt silindi\n`);
    
    // Sonraki durumu göster
    const after = await pgService.query(`
      SELECT status, COUNT(*) as count 
      FROM sync_queue 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    console.log('Sonraki Durum:');
    if (after.length === 0) {
      console.log('  (Kayıt yok)');
    } else {
      after.forEach(r => {
        console.log(`  ${r.status}: ${r.count}`);
      });
    }
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

cleanFailedQueue();
