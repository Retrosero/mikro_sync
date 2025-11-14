require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

async function testConnections() {
  console.log('='.repeat(60));
  console.log('Veritabanı Bağlantı Testi');
  console.log('='.repeat(60));

  // PostgreSQL Test
  try {
    console.log('\n[PostgreSQL] Bağlantı test ediliyor...');
    const pgResult = await pgService.query('SELECT NOW() as current_time, version()');
    console.log('✓ PostgreSQL bağlantısı başarılı');
    console.log(`  Zaman: ${pgResult[0].current_time}`);
    console.log(`  Versiyon: ${pgResult[0].version.split(',')[0]}`);
  } catch (error) {
    console.error('✗ PostgreSQL bağlantı hatası:', error.message);
  }

  // MS SQL Test
  try {
    console.log('\n[MS SQL] Bağlantı test ediliyor...');
    const mssqlResult = await mssqlService.query('SELECT GETDATE() as current_time, @@VERSION as version');
    console.log('✓ MS SQL bağlantısı başarılı');
    console.log(`  Zaman: ${mssqlResult[0].current_time}`);
    console.log(`  Versiyon: ${mssqlResult[0].version.split('\n')[0]}`);
  } catch (error) {
    console.error('✗ MS SQL bağlantı hatası:', error.message);
  }

  // Tablo Kontrolleri
  console.log('\n' + '='.repeat(60));
  console.log('Tablo Kontrolleri');
  console.log('='.repeat(60));

  try {
    console.log('\n[PostgreSQL] Tablolar kontrol ediliyor...');
    
    const tables = ['sync_queue', 'int_kodmap_cari', 'int_kodmap_stok', 'sync_logs'];
    for (const table of tables) {
      const result = await pgService.query(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      console.log(`  ✓ ${table}: ${result[0].count} kayıt`);
    }
  } catch (error) {
    console.error('  ✗ PostgreSQL tablo hatası:', error.message);
    console.log('  → Lütfen "npm run setup-db" komutunu çalıştırın');
  }

  try {
    console.log('\n[MS SQL] Tablolar kontrol ediliyor...');
    
    const tables = ['SYNC_QUEUE', 'INT_KodMap_Cari', 'INT_KodMap_Stok', 'SYNC_LOGS'];
    for (const table of tables) {
      const result = await mssqlService.query(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      console.log(`  ✓ ${table}: ${result[0].count} kayıt`);
    }
  } catch (error) {
    console.error('  ✗ MS SQL tablo hatası:', error.message);
    console.log('  → Lütfen "npm run setup-db" komutunu çalıştırın');
  }

  // Mapping Kontrolleri
  console.log('\n' + '='.repeat(60));
  console.log('Mapping Kontrolleri');
  console.log('='.repeat(60));

  try {
    const cariCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_cari');
    const stokCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_stok');
    const bankaCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_banka');
    const kasaCount = await pgService.query('SELECT COUNT(*) as count FROM int_kodmap_kasa');

    console.log(`\n  Cari Mapping: ${cariCount[0].count} kayıt`);
    console.log(`  Stok Mapping: ${stokCount[0].count} kayıt`);
    console.log(`  Banka Mapping: ${bankaCount[0].count} kayıt`);
    console.log(`  Kasa Mapping: ${kasaCount[0].count} kayıt`);

    if (cariCount[0].count === 0 || stokCount[0].count === 0) {
      console.log('\n  ⚠ Uyarı: Mapping tabloları boş!');
      console.log('  → Lütfen mapping verilerini ekleyin (KURULUM.md dosyasına bakın)');
    }
  } catch (error) {
    console.error('  ✗ Mapping kontrol hatası:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Tamamlandı');
  console.log('='.repeat(60) + '\n');

  // Bağlantıları kapat
  await pgService.disconnect();
  await mssqlService.disconnect();
  
  process.exit(0);
}

testConnections();
