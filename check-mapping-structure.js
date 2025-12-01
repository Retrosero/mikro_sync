require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkMappingStructure() {
  try {
    console.log('Mapping tablo yapısı kontrol ediliyor...\n');
    
    const result = await pgService.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'int_kodmap_cari'
      ORDER BY ordinal_position
    `);

    console.log('int_kodmap_cari kolonları:');
    result.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });

    console.log('\nÖrnek veri:');
    const sample = await pgService.query(`
      SELECT * FROM int_kodmap_cari LIMIT 5
    `);
    
    console.log(sample);

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await pgService.disconnect();
    process.exit(0);
  }
}

checkMappingStructure();
