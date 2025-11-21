require('dotenv').config();
const { spawn } = require('child_process');

const batchSizes = [500, 1000, 2000, 5000];
const results = [];

async function testBatchSize(size) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing BATCH_SIZE=${size}`);
    console.log('='.repeat(70));
    
    const startTime = Date.now();
    
    const env = { ...process.env, BATCH_SIZE: size.toString() };
    const proc = spawn('node', ['scripts/fast_bulk_sync.js'], { 
      env,
      stdio: 'inherit'
    });
    
    proc.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      results.push({
        batchSize: size,
        duration: parseFloat(duration),
        success: code === 0
      });
      
      console.log(`\nBatch Size ${size}: ${duration}s (${code === 0 ? '✓' : '✗'})`);
      resolve();
    });
  });
}

async function runTests() {
  console.log('BATCH SIZE PERFORMANS TESTİ');
  console.log('='.repeat(70));
  console.log('Test edilecek batch size\'lar:', batchSizes.join(', '));
  console.log();
  
  for (const size of batchSizes) {
    await testBatchSize(size);
    // 5 saniye bekle
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('TEST SONUÇLARI');
  console.log('='.repeat(70));
  console.log();
  
  // Tabloyu yazdır
  console.log('| Batch Size | Süre (s) | Durum |');
  console.log('|------------|----------|-------|');
  results.forEach(r => {
    console.log(`| ${r.batchSize.toString().padEnd(10)} | ${r.duration.toString().padEnd(8)} | ${r.success ? '✓' : '✗'} |`);
  });
  
  // En hızlı olanı bul
  const fastest = results.reduce((prev, curr) => 
    curr.duration < prev.duration ? curr : prev
  );
  
  console.log();
  console.log(`En Hızlı: BATCH_SIZE=${fastest.batchSize} (${fastest.duration}s)`);
  
  // Performans karşılaştırması
  const baseline = results[0];
  console.log();
  console.log('Performans Karşılaştırması (500 batch baz alınarak):');
  results.forEach(r => {
    const improvement = ((baseline.duration - r.duration) / baseline.duration * 100).toFixed(1);
    console.log(`  ${r.batchSize}: ${improvement > 0 ? '+' : ''}${improvement}% ${improvement > 0 ? 'daha hızlı' : 'daha yavaş'}`);
  });
  
  process.exit(0);
}

runTests();
