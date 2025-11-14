const fs = require('fs');
const path = require('path');

// Log dosyasını oku ve analiz et
function analyzeLogs(logFile) {
  const logPath = path.join(__dirname, '..', 'logs', logFile);
  
  if (!fs.existsSync(logPath)) {
    console.log(`❌ Log dosyası bulunamadı: ${logFile}`);
    return;
  }

  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  console.log('\n' + '='.repeat(70));
  console.log(`  Log Analizi: ${logFile}`);
  console.log('='.repeat(70) + '\n');

  // İstatistikler
  const stats = {
    total: lines.length,
    error: 0,
    warn: 0,
    info: 0,
    syncSuccess: 0,
    syncError: 0,
    mappingError: 0,
    dbConnection: 0,
    performance: 0
  };

  const errors = [];
  const warnings = [];
  const slowOperations = [];
  const mappingErrors = [];

  lines.forEach(line => {
    // Seviye sayımı
    if (line.includes('[ERROR]')) stats.error++;
    else if (line.includes('[WARN]')) stats.warn++;
    else if (line.includes('[INFO]')) stats.info++;

    // Context sayımı
    if (line.includes('[sync-success]')) stats.syncSuccess++;
    if (line.includes('[sync-error]')) stats.syncError++;
    if (line.includes('[mapping-error]')) stats.mappingError++;
    if (line.includes('[db-connection]')) stats.dbConnection++;
    if (line.includes('[performance]')) stats.performance++;

    // Hataları topla
    if (line.includes('[ERROR]')) {
      errors.push(line);
    }

    // Uyarıları topla
    if (line.includes('[WARN]')) {
      warnings.push(line);
    }

    // Yavaş işlemleri topla
    if (line.includes('5 saniyeden uzun sürdü')) {
      slowOperations.push(line);
    }

    // Mapping hatalarını topla
    if (line.includes('Mapping bulunamadı')) {
      mappingErrors.push(line);
    }
  });

  // Genel İstatistikler
  console.log('📊 Genel İstatistikler:');
  console.log(`  Toplam Log: ${stats.total}`);
  console.log(`  ✅ Info: ${stats.info}`);
  console.log(`  ⚠️  Warn: ${stats.warn}`);
  console.log(`  ❌ Error: ${stats.error}`);
  console.log();

  // Senkronizasyon İstatistikleri
  console.log('🔄 Senkronizasyon İstatistikleri:');
  console.log(`  ✅ Başarılı: ${stats.syncSuccess}`);
  console.log(`  ❌ Başarısız: ${stats.syncError}`);
  if (stats.syncSuccess + stats.syncError > 0) {
    const successRate = ((stats.syncSuccess / (stats.syncSuccess + stats.syncError)) * 100).toFixed(2);
    console.log(`  📈 Başarı Oranı: ${successRate}%`);
  }
  console.log();

  // Diğer İstatistikler
  console.log('📋 Diğer İstatistikler:');
  console.log(`  🗺️  Mapping Hataları: ${stats.mappingError}`);
  console.log(`  🔌 DB Bağlantı Logları: ${stats.dbConnection}`);
  console.log(`  ⏱️  Performans Uyarıları: ${stats.performance}`);
  console.log();

  // Son 10 Hata
  if (errors.length > 0) {
    console.log('❌ Son 10 Hata:');
    errors.slice(-10).forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.substring(0, 150)}...`);
    });
    console.log();
  }

  // Mapping Hataları
  if (mappingErrors.length > 0) {
    console.log('🗺️  Mapping Hataları (Son 5):');
    mappingErrors.slice(-5).forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.substring(0, 150)}...`);
    });
    console.log();
  }

  // Yavaş İşlemler
  if (slowOperations.length > 0) {
    console.log('⏱️  Yavaş İşlemler (Son 5):');
    slowOperations.slice(-5).forEach((op, index) => {
      console.log(`  ${index + 1}. ${op.substring(0, 150)}...`);
    });
    console.log();
  }

  // Öneriler
  console.log('💡 Öneriler:');
  if (stats.mappingError > 0) {
    console.log('  • Mapping hatalarını düzeltmek için int_kodmap_* tablolarını kontrol edin');
  }
  if (stats.syncError > stats.syncSuccess) {
    console.log('  • Başarısız senkronizasyon oranı yüksek, hata loglarını inceleyin');
  }
  if (slowOperations.length > 0) {
    console.log('  • Yavaş işlemler var, performans optimizasyonu gerekebilir');
  }
  if (stats.error === 0 && stats.warn === 0) {
    console.log('  ✅ Sistem sorunsuz çalışıyor!');
  }
  console.log();

  console.log('='.repeat(70) + '\n');
}

// Komut satırı argümanları
const args = process.argv.slice(2);
const logFile = args[0] || 'combined.log';

analyzeLogs(logFile);

// Kullanım bilgisi
if (args.includes('--help') || args.includes('-h')) {
  console.log('Kullanım:');
  console.log('  node scripts/analyze-logs.js [log-dosyası]');
  console.log('');
  console.log('Örnekler:');
  console.log('  node scripts/analyze-logs.js');
  console.log('  node scripts/analyze-logs.js error.log');
  console.log('  node scripts/analyze-logs.js sync.log');
}
