const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'db.s3db'));

console.log('='.repeat(60));
console.log('DB.S3DB VERİTABANI ANALİZİ');
console.log('='.repeat(60));

console.log('\n📋 TABLOLAR:');
console.log('-'.repeat(40));
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
tables.forEach(t => console.log(' • ' + t.name));

console.log('\n⚡ TRIGGER\'LAR:');
console.log('-'.repeat(40));
const triggers = db.prepare(`SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'`).all();
if (triggers.length === 0) {
    console.log('   Trigger bulunamadı.');
} else {
    triggers.forEach(t => {
        console.log(`\n📌 ${t.name} (Tablo: ${t.tbl_name})`);
        console.log(t.sql);
    });
}

console.log('\n👁️ VIEW\'LAR:');
console.log('-'.repeat(40));
const views = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type='view'`).all();
if (views.length === 0) {
    console.log('   View bulunamadı.');
} else {
    views.forEach(v => {
        console.log(`\n📌 ${v.name}`);
        console.log(v.sql);
    });
}

// Kısayol ve rapor ile ilgili tabloları ara
console.log('\n🔍 KISAYOL / RAPOR İLGİLİ TABLOLAR:');
console.log('-'.repeat(40));
const searchTerms = ['shortcut', 'kisayol', 'kısayol', 'hotkey', 'key', 'report', 'rapor', 'komut', 'command', 'menu', 'menü'];
tables.forEach(t => {
    const tableName = t.name.toLowerCase();
    if (searchTerms.some(term => tableName.includes(term))) {
        console.log(`\n📊 ${t.name} tablosu:`);
        const columns = db.prepare(`PRAGMA table_info(${t.name})`).all();
        console.log('   Sütunlar:', columns.map(c => c.name).join(', '));
        const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${t.name}`).get();
        console.log('   Kayıt sayısı:', count.cnt);
        if (count.cnt > 0 && count.cnt <= 50) {
            const rows = db.prepare(`SELECT * FROM ${t.name}`).all();
            console.log('   Veriler:');
            rows.forEach(r => console.log('   ', JSON.stringify(r)));
        }
    }
});

// Tüm tabloların yapısını göster
console.log('\n\n📊 TÜM TABLOLARIN YAPISI:');
console.log('='.repeat(60));
tables.forEach(t => {
    console.log(`\n📁 ${t.name}`);
    const columns = db.prepare(`PRAGMA table_info(${t.name})`).all();
    columns.forEach(c => {
        console.log(`   • ${c.name} (${c.type})${c.pk ? ' [PK]' : ''}`);
    });
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${t.name}`).get();
    console.log(`   📊 Kayıt sayısı: ${count.cnt}`);
});

db.close();
console.log('\n✅ Analiz tamamlandı.');
