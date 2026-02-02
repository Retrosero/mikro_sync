const Database = require('better-sqlite3');
const dbPath = 'C:\\Ana Entegra\\db.s3db';

try {
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%attribute%'").all();

    console.log('--- Pazaryeri Özelliklerinde "Uyum" Araması ---');
    for (const table of tables) {
        try {
            const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
            const nameCol = columns.find(c => c.name.toLowerCase() === 'name' || c.name.toLowerCase() === 'attribute_name');
            if (nameCol) {
                const rows = db.prepare(`SELECT DISTINCT "${nameCol.name}" FROM "${table.name}" WHERE "${nameCol.name}" LIKE '%uyum%' AND "${nameCol.name}" NOT LIKE '%kuyumcu%'`).all();
                if (rows.length > 0) {
                    console.log(`Tablo: ${table.name}`);
                    rows.forEach(r => console.log(`  - Başlık: ${r[nameCol.name]}`));
                }
            }
        } catch (e) { }
    }

    db.close();
} catch (e) {
    console.error(e);
}
