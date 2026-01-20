const Database = require('better-sqlite3');

// Desktop'taki db.s3db dosyasını analiz et
const dbPath = 'C:\\Users\\Gürbüz Oyuncak\\Desktop\\db.s3db';
const db = new Database(dbPath);


const fs = require('fs');

const logFile = 'analysis_report_utf8.txt';
let logContent = '';

function log(message) {
    console.log(message); // Keep console output
    logContent += message + '\n';
}

console.log('='.repeat(80));
log('='.repeat(80));
log('📁 KISAYOL ve RAPOR ANALİZİ: ' + dbPath);
log('='.repeat(80));

// Tüm tabloları al
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
log('\n📋 TOPLAM TABLO SAYISI: ' + tables.length);

// Kısayol, hotkey, shortcut ile ilgili tablolar
log('\n\n🔥 KISAYOL İLİŞKİLİ TABLOLAR:');
log('='.repeat(60));
const shortcutKeywords = ['shortcut', 'kisayol', 'kısayol', 'hotkey', 'key', 'tugla', 'tuşla', 'button'];
tables.forEach(t => {
    const tableName = t.name.toLowerCase();
    if (shortcutKeywords.some(k => tableName.includes(k))) {
        log('\n📌 ' + t.name);
        const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
        log('   Kolonlar: ' + cols.map(c => c.name).join(', '));
        const count = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
        log('   Kayıt: ' + count.cnt);
        if (count.cnt > 0 && count.cnt <= 30) {
            const rows = db.prepare(`SELECT * FROM "${t.name}"`).all();
            rows.forEach(r => log('   ' + JSON.stringify(r)));
        }
    }
});

// Rapor ile ilgili tablolar
log('\n\n📊 RAPOR İLİŞKİLİ TABLOLAR:');
log('='.repeat(60));
const reportKeywords = ['report', 'rapor', 'print', 'yazdir', 'yazdır', 'baskı', 'baski', 'label', 'etiket', 'sablon', 'şablon', 'template'];
tables.forEach(t => {
    const tableName = t.name.toLowerCase();
    if (reportKeywords.some(k => tableName.includes(k))) {
        log('\n📌 ' + t.name);
        const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
        log('   Kolonlar: ' + cols.map(c => c.name).join(', '));
        const count = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
        log('   Kayıt: ' + count.cnt);
        if (count.cnt > 0 && count.cnt <= 30) {
            const rows = db.prepare(`SELECT * FROM "${t.name}"`).all();
            rows.forEach(r => log('   ' + JSON.stringify(r)));
        }
    }
});

// Menü, komut, action ile ilgili tablolar
log('\n\n🎯 MENÜ / KOMUT / AKSİYON TABLOLARI:');
log('='.repeat(60));
const menuKeywords = ['menu', 'menü', 'command', 'komut', 'action', 'aksiyon', 'islem', 'işlem', 'trigger'];
tables.forEach(t => {
    const tableName = t.name.toLowerCase();
    if (menuKeywords.some(k => tableName.includes(k))) {
        log('\n📌 ' + t.name);
        const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
        log('   Kolonlar: ' + cols.map(c => c.name).join(', '));
        const count = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
        log('   Kayıt: ' + count.cnt);
        if (count.cnt > 0 && count.cnt <= 30) {
            const rows = db.prepare(`SELECT * FROM "${t.name}"`).all();
            rows.forEach(r => log('   ' + JSON.stringify(r)));
        }
    }
});

// Settings, ayar, config ile ilgili tablolar
log('\n\n⚙️ AYAR / KONFİGÜRASYON TABLOLARI:');
log('='.repeat(60));
const settingsKeywords = ['settings', 'ayar', 'config', 'preference', 'tercih', 'option'];
tables.forEach(t => {
    const tableName = t.name.toLowerCase();
    if (settingsKeywords.some(k => tableName.includes(k))) {
        log('\n📌 ' + t.name);
        const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
        log('   Kolonlar: ' + cols.map(c => c.name).join(', '));
        const count = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
        log('   Kayıt: ' + count.cnt);
        if (count.cnt > 0 && count.cnt <= 30) {
            const rows = db.prepare(`SELECT * FROM "${t.name}"`).all();
            rows.forEach((r, i) => log(`   [${i + 1}] ` + JSON.stringify(r)));
        }
    }
});

// Tüm tabloları listele (kısa)
log('\n\n📋 TÜM TABLOLAR (Özet):');
log('='.repeat(60));
tables.forEach(t => {
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
    log(`${t.name.padEnd(45)} → ${count.cnt} kayıt`);
});

// Trigger'ları kontrol et
log('\n\n⚡ TRİGGER\'LAR:');
log('='.repeat(60));
const triggers = db.prepare(`SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'`).all();
if (triggers.length === 0) {
    log('   SQLite Trigger bulunamadı.');
} else {
    triggers.forEach(t => {
        log(`\n📌 ${t.name} → ${t.tbl_name}`);
        log(t.sql);
    });
}

db.close();
log('\n✅ Analiz tamamlandı.');

fs.writeFileSync(logFile, logContent, 'utf8');
console.log(`Raporu ${logFile} dosyasına kaydettim.`);
