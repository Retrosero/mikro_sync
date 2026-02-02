const Database = require('better-sqlite3');
const dbPath = 'C:\\Ana Entegra\\db.s3db';

try {
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

    console.log('--- "uyum" içeren sütun isimleri ---');
    for (const table of tables) {
        const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
        for (const col of columns) {
            if (col.name.toLowerCase().includes('uyum')) {
                console.log(`Tablo: ${table.name}, Sütun: ${col.name}`);
            }
        }
    }

    console.log('\n--- "uyum" içeren kategori veya özellik isimleri ---');
    // Bazı tablolarda kategori veya özellik adı olarak geçebilir
    const checkTables = ['category', 'attribute', 'specification', 'spec', 'option'];
    for (const table of tables) {
        if (checkTables.some(ct => table.name.toLowerCase().includes(ct))) {
            const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
            const nameCol = columns.find(c => c.name.toLowerCase().includes('name') || c.name.toLowerCase().includes('adi') || c.name.toLowerCase().includes('tanim'));
            if (nameCol) {
                const rows = db.prepare(`SELECT "${nameCol.name}" FROM "${table.name}" WHERE "${nameCol.name}" LIKE '%uyum%' AND "${nameCol.name}" NOT LIKE '%kuyumcu%'`).all();
                if (rows.length > 0) {
                    console.log(`Tablo: ${table.name}, Sütun: ${nameCol.name} içindeki değerler:`);
                    rows.forEach(r => console.log(`  - ${r[nameCol.name]}`));
                }
            }
        }
    }

    db.close();
} catch (e) {
    console.error(e);
}
