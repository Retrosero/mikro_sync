const Database = require('better-sqlite3');
const dbPath = 'C:\\Ana Entegra\\db.s3db';

try {
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

    console.log('--- Bulunan Uyumlulukla İlgili Başlıklar (Sütun veya Özellik Adları) ---');

    const results = new Set();

    for (const table of tables) {
        // 1. Check column names
        const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
        for (const col of columns) {
            if (col.name.toLowerCase().includes('uyum') && !col.name.toLowerCase().includes('kuyumcu')) {
                results.add(`Tablo: ${table.name}, Sütun: ${col.name}`);
            }
        }

        // 2. Check content of attribute/spec tables
        const lowerName = table.name.toLowerCase();
        if (lowerName.includes('attribute') || lowerName.includes('spec') || lowerName.includes('ozellik') || lowerName.includes('prop')) {
            const nameCols = columns.filter(c => c.name.toLowerCase().includes('name') || c.name.toLowerCase().includes('adi') || c.name.toLowerCase().includes('header'));
            for (const col of nameCols) {
                try {
                    const rows = db.prepare(`SELECT DISTINCT "${col.name}" FROM "${table.name}" WHERE "${col.name}" LIKE '%uyum%' AND "${col.name}" NOT LIKE '%kuyumcu%'`).all();
                    rows.forEach(r => {
                        results.add(`Özellik Başlığı: "${r[col.name]}" (Tablo: ${table.name}, Sütun: ${col.name})`);
                    });
                } catch (e) { }
            }
        }
    }

    results.forEach(res => console.log(res));

    db.close();
} catch (e) {
    console.error(e);
}
