const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = 'C:\\Users\\Gürbüz Oyuncak\\Desktop\\db.s3db';
const db = new Database(dbPath);
const outputFile = 'settings_search_utf8.txt';
let output = '';

function log(msg) {
    console.log(msg);
    output += msg + '\n';
}

log('='.repeat(80));
log('🔍 SETTINGS TABLOSUNDA KISAYOL ARAMA');
log('='.repeat(80));

const searchTerms = ['key', 'short', 'cut', 'kisayol', 'tuş', 'button', 'hot', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'ctrl', 'alt', 'shift'];

const query = `
    SELECT name, value 
    FROM settings 
    WHERE ${searchTerms.map(term => `name LIKE '%${term}%'`).join(' OR ')}
      OR ${searchTerms.map(term => `value LIKE '%${term}%'`).join(' OR ')}
`;

const results = db.prepare(query).all();

log(`Toplam ${results.length} eşleşme bulundu.`);
results.forEach(row => {
    log(`[${row.name}]: ${row.value}`);
});

log('\n\n🔍 REPORT_DESIGN DETAYLARI:');
log('='.repeat(80));
const reports = db.prepare('SELECT * FROM report_design').all();
reports.forEach(r => {
    log(`\n📌 RAPOR: ${r.name} (ID: ${r.id})`);
    log(`   Boyut: ${r.width}x${r.height} ${r.orientation}`);

    const elements = db.prepare('SELECT * FROM report_design_elements WHERE report_design_id = ? ORDER BY sira').all(r.id);
    log(`   Eleman Sayısı: ${elements.length}`);
    elements.forEach(e => {
        log(`   - [${e.e_type}] ${e.name}: ${e.value || ''} (Pos: ${e.e_margin_left},${e.e_margin_top})`);
    });
});

db.close();
fs.writeFileSync(outputFile, output, 'utf8');
console.log(`Rapor ${outputFile} dosyasına kaydedildi.`);
