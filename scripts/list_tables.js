const Database = require('better-sqlite3');
const dbPath = 'C:\\Ana Entegra\\db.s3db';

try {
    const db = new Database(dbPath, { readonly: true });

    console.log('--- Tablo isimlerinde "uyum" veya "uyumluluk" geçenler ---');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%uyum%' OR name LIKE '%uyumluluk%')").all();
    if (tables.length > 0) {
        tables.forEach(t => console.log(`Tablo: ${t.name}`));
    } else {
        console.log('Tablo bulunamadı.');
    }

    console.log('\n--- Tüm tablo isimleri (ilk 200) ---');
    const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 200").all();
    console.log(allTables.map(t => t.name).join(', '));

    db.close();
} catch (e) {
    console.error(e);
}
