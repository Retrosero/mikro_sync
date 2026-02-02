const Database = require('better-sqlite3');
const dbPath = 'C:\\Ana Entegra\\db.s3db';

try {
    const db = new Database(dbPath, { readonly: true });

    console.log('--- "spec" veya "attribute" içeren tablolar ---');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%spec%' OR name LIKE '%attr%' OR name LIKE '%prop%')").all();
    tables.forEach(t => {
        console.log(`Tablo: ${t.name}`);
        const columns = db.prepare(`PRAGMA table_info("${t.name}")`).all();
        console.log(`  Sütunlar: ${columns.map(c => c.name).join(', ')}`);
    });

    console.log('\n--- "uyumluluk" araması (tüm veritabanı) ---');
    const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    for (const table of allTables) {
        const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
        const textCols = columns.filter(c => c.type.toUpperCase().includes('CHAR') || c.type.toUpperCase().includes('TEXT') || c.type === '');

        for (const col of textCols) {
            try {
                const row = db.prepare(`SELECT "${col.name}" FROM "${table.name}" WHERE "${col.name}" LIKE '%uyumlu%' AND "${col.name}" NOT LIKE '%kuyumcu%' LIMIT 1`).get();
                if (row) {
                    console.log(`BULDUM! Tablo: ${table.name}, Sütun: ${col.name}`);
                    console.log(`Örnek Veri: ${row[col.name]}`);
                }
            } catch (e) { }
        }
    }

    db.close();
} catch (e) {
    console.error(e);
}
