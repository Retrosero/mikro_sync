require('dotenv').config();
const { Client } = require('pg');
const logger = require('../utils/logger');

async function setupSupabase() {
  console.log('\n' + '='.repeat(70));
  console.log('  Supabase Kurulum ve Test');
  console.log('='.repeat(70) + '\n');

  // Bağlantı bilgilerini göster
  console.log('📋 Bağlantı Bilgileri:');
  console.log(`  Host: ${process.env.PG_HOST}`);
  console.log(`  Port: ${process.env.PG_PORT}`);
  console.log(`  Database: ${process.env.PG_DATABASE}`);
  console.log(`  User: ${process.env.PG_USER}`);
  console.log(`  SSL: ${process.env.PG_SSL}`);
  console.log();

  // Bağlantı testi
  console.log('🔌 Bağlantı test ediliyor...\n');

  const client = new Client({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    await client.connect();
    console.log('✅ Bağlantı başarılı!\n');

    // Versiyon kontrolü
    const versionResult = await client.query('SELECT version()');
    console.log('📊 PostgreSQL Versiyonu:');
    console.log(`  ${versionResult.rows[0].version.split(',')[0]}\n`);

    // Supabase kontrolü
    const supabaseCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_extension WHERE extname = 'supabase_vault'
      ) as is_supabase
    `);
    
    if (supabaseCheck.rows[0].is_supabase) {
      console.log('✅ Supabase ortamı tespit edildi\n');
    } else {
      console.log('ℹ️  Standart PostgreSQL ortamı\n');
    }

    // Mevcut tabloları kontrol et
    console.log('📋 Mevcut Tablolar:');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach(row => {
        console.log(`  • ${row.table_name}`);
      });
    } else {
      console.log('  (Henüz tablo yok)');
    }
    console.log();

    // Senkronizasyon tabloları kontrolü
    console.log('🔍 Senkronizasyon Tabloları Kontrolü:');
    const syncTables = ['sync_queue', 'sync_logs', 'int_kodmap_cari', 'int_kodmap_stok'];
    
    for (const table of syncTables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);

      if (exists.rows[0].exists) {
        const count = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  ✅ ${table} (${count.rows[0].count} kayıt)`);
      } else {
        console.log(`  ❌ ${table} (yok)`);
      }
    }
    console.log();

    // Öneriler
    console.log('💡 Öneriler:');
    
    const missingTables = [];
    for (const table of syncTables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      
      if (!exists.rows[0].exists) {
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      console.log('  • Eksik tablolar var. Kurulum için:');
      console.log('    npm run setup-db');
    } else {
      console.log('  ✅ Tüm senkronizasyon tabloları mevcut');
    }

    // Mapping kontrolü
    const cariCount = await client.query('SELECT COUNT(*) FROM int_kodmap_cari');
    const stokCount = await client.query('SELECT COUNT(*) FROM int_kodmap_stok');

    if (cariCount.rows[0].count === '0' || stokCount.rows[0].count === '0') {
      console.log('  • Mapping tabloları boş. Veri eklemek için:');
      console.log('    scripts/sample-mappings.sql dosyasını Supabase SQL Editor\'de çalıştırın');
    } else {
      console.log(`  ✅ Mapping verileri mevcut (Cari: ${cariCount.rows[0].count}, Stok: ${stokCount.rows[0].count})`);
    }

    console.log();
    console.log('='.repeat(70));
    console.log('  Kurulum Tamamlandı!');
    console.log('='.repeat(70) + '\n');

    console.log('🚀 Başlatmak için:');
    console.log('  npm start\n');

  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    console.error('\n🔧 Çözüm Önerileri:');
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('  • Host adresini kontrol edin (PG_HOST)');
      console.error('  • İnternet bağlantınızı kontrol edin');
    } else if (error.message.includes('password authentication failed')) {
      console.error('  • Şifrenizi kontrol edin (PG_PASSWORD)');
      console.error('  • Supabase Dashboard\'dan şifreyi sıfırlayın');
    } else if (error.message.includes('self signed certificate')) {
      console.error('  • .env dosyasında PG_SSL=true olduğundan emin olun');
    } else if (error.message.includes('timeout')) {
      console.error('  • Firewall ayarlarını kontrol edin');
      console.error('  • Supabase Dashboard\'da IP izin listesini kontrol edin');
    } else {
      console.error('  • SUPABASE-BAGLANTI.md dosyasını inceleyin');
      console.error('  • .env dosyanızı kontrol edin');
    }
    
    console.error('\n📚 Detaylı bilgi için: SUPABASE-BAGLANTI.md\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupSupabase();
