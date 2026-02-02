const Database = require('better-sqlite3');
const dbPath = 'C:\\Ana Entegra\\db.s3db';

try {
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    const targetTables = tables.filter(t => 
        t.name.includes('product') && 
        (t.name.includes('attr') || t.name.includes('spec') || t.name.includes('prop'))
    );

    console.log('--- Ürün Özellik/Tanım Tabloları ---');
    for (const table of targetTables) {
        console.log(`Tablo: ${table.name}`);
        const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
        console.log(`  Sütunlar: ${columns.map(c => c.name).join(', ')}`);
        
        // Bu tablolarda "Uyum" geçen verileri örnekle
        try {
            const rows = db.prepare(`SELECT * FROM "${table.name}" WHERE (attribute_name LIKE '%uyum%' OR name LIKE '%uyum%' OR attribute_value_name LIKE '%uyum%') LIMIT 3`).all();
            if (rows.length > 0) {
                console.log(`  Örnek Veriler:`, rows);
            }
        } catch (e) {}
    }

    db.close();
} catch (e) {
    console.error(e);
}
