const XLSX = require('xlsx');
const path = require('path');

try {
    const filePath = path.join(__dirname, '..', 'uyum.xlsx');
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    console.log('Excel Dosyası Analizi');
    console.log('=====================');
    console.log(`Toplam satır sayısı: ${data.length}`);
    console.log('\nİlk 5 satır:');
    data.slice(0, 5).forEach((row, i) => {
        console.log(`Satır ${i}:`, row);
    });

    console.log('\nSütun Yapısı:');
    if (data.length > 0) {
        const headers = data[0];
        headers.forEach((h, i) => {
            console.log(`  Sütun ${String.fromCharCode(65 + i)}: ${h || '(boş)'}`);
        });
    }
} catch (e) {
    console.error('Hata:', e.message);
}
