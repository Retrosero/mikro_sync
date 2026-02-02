const Database = require('better-sqlite3');
const dbPath = 'C:\\Ana Entegra\\db.s3db';

try {
    const db = new Database(dbPath, { readonly: true });

    // 1. "uyumluluk" veya "uyumlu" kelimesini içeren başlıkları (sütunları) bul
    console.log('--- Sütun isimlerinde "uyum" geçen tablolar ---');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

    for (const table of tables) {
        const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
        const matchingCols = columns.filter(c => c.name.toLowerCase().includes('uyum'));
        if (matchingCols.length > 0) {
            console.log(`Tablo: ${table.name}`);
            matchingCols.forEach(c => console.log(`  - Sütun: ${c.name}`));
        }
    }

    // 2. İçeriğinde "uyumlu" veya "uyumluluk" (ama kuyumcu değil) geçen kayıtları bul
    console.log('\n--- İçeriğinde "uyumlu" veya "uyumluluk" geçen kayıtlar (Örnekler) ---');
    const searchTerms = ['uyumluluk', 'uyumlu'];

    for (const table of tables) {
        const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
        const textCols = columns.filter(c => {
            const type = c.type.toUpperCase();
            return type.includes('CHAR') || type.includes('TEXT') || type === '';
        });

        for (const col of textCols) {
            try {
                // Kuyumcu/Kuyumculuk kelimelerini elemek için NOT LIKE ekliyoruz
                const query = `
                    SELECT "${col.name}" 
                    FROM "${table.name}" 
                    WHERE ("${col.name}" LIKE '%uyumluluk%' OR "${col.name}" LIKE '%uyumlu %' OR "${col.name}" LIKE '% uyumlu%')
                    AND "${col.name}" NOT LIKE '%kuyumcu%' 
                    LIMIT 5
                `;
                const rows = db.prepare(query).all();
                if (rows.length > 0) {
                    console.log(`Tablo: ${table.name}, Sütun: ${col.name}`);
                    rows.forEach(r => console.log(`  - ${String(r[col.name]).substring(0, 100)}`));
                }
            } catch (e) { }
        }
    }

    db.close();
} catch (e) {
    console.error(e);
}
