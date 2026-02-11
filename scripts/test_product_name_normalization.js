require('dotenv').config();
const productNormalizer = require('../services/product-name-normalizer.service');

// Test cases for Turkish character normalization
const testCases = [
    {
        input: 'BİSİKLET OYUNCAK 12 CM',
        expected: 'Bisiklet Oyuncak 12 CM'
    },
    {
        input: 'ŞEKER ÇUBUK OYUNCAK',
        expected: 'Şeker Çubuk Oyuncak'
    },
    {
        input: 'PELUŞ OYUNCAK 30 CM 3 AST',
        expected: 'Peluş Oyuncak 30 CM 3 Ast'
    },
    {
        input: 'OYUNCAK - SET',
        expected: 'Oyuncak - Set'
    },
    {
        input: 'PeLuŞ OYUNCAK',
        expected: 'Peluş Oyuncak'
    },
    {
        input: 'ÜRÜN İSMİ ÇOK GÜZEL',
        expected: 'Ürün İsmi Çok Güzel'
    },
    {
        input: 'LED IŞIKLI OYUNCAK',
        expected: 'LED Işıklı Oyuncak'
    },
    {
        input: 'USB ŞARJLI ARABA',
        expected: 'USB Şarjlı Araba'
    },
    {
        input: '3D PUZZLE SET',
        expected: '3D Puzzle Set'
    },
    {
        input: 'OYUNCAK 100 GR',
        expected: 'Oyuncak 100 GR'
    },
    {
        input: 'OYUNCAK 2 KG',
        expected: 'Oyuncak 2 KG'
    },
    {
        input: 'OYUNCAK 500 ML',
        expected: 'Oyuncak 500 ML'
    }
];

console.log('🧪 Ürün İsmi Normalizasyon Testleri\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    const result = productNormalizer.normalizeProductName(testCase.input);
    const success = result === testCase.expected;

    if (success) {
        passed++;
        console.log(`\n✅ Test ${index + 1}: BAŞARILI`);
    } else {
        failed++;
        console.log(`\n❌ Test ${index + 1}: BAŞARISIZ`);
    }

    console.log(`   Girdi:    "${testCase.input}"`);
    console.log(`   Beklenen: "${testCase.expected}"`);
    console.log(`   Sonuç:    "${result}"`);
});

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Sonuç: ${passed} başarılı, ${failed} başarısız (Toplam: ${testCases.length})`);

if (failed === 0) {
    console.log('\n🎉 Tüm testler başarılı!');
    process.exit(0);
} else {
    console.log('\n⚠️  Bazı testler başarısız oldu.');
    process.exit(1);
}
