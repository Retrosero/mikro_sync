const Database = require('better-sqlite3');
const path = require('path');

const dbPath = 'C:\\Ana Entegra\\db.s3db';

try {
    const db = new Database(dbPath, { readonly: true });
    console.log(`Bağlantı başarılı: ${dbPath}`);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`Bulunan tablo sayısı: ${tables.length}`);

    let foundAny = false;

    for (const table of tables) {
        const tableName = table.name;

        // 1. Sütun isimlerinde ara
        let columns = [];
        try {
            columns = db.prepare(`PRAGMA table_info("${tableName}")`).all();
        } catch (e) {
            continue;
        }

        const matchingColumns = columns.filter(c => c.name.toLowerCase().includes('uyum'));

        if (matchingColumns.length > 0) {
            console.log(`\n[TABLO: ${tableName}] Sütun isimlerinde eşleşme bulundu:`);
            matchingColumns.forEach(c => console.log(` - Sütun: ${c.name}`));
            foundAny = true;
        }

        // 2. Veri içinde ara
        // Tip kontrolü yapmadan tüm sütunlarda aramayı deneyelim, ama hataları yakalayalım
        for (const col of columns) {
            try {
                // Sadece string tipi olabilecekleri veya tipi belirtilmemişleri kontrol et
                const colType = col.type.toUpperCase();
                if (colType.includes('CHAR') || colType.includes('TEXT') || colType === '') {
                    const query = `SELECT "${col.name}" FROM "${tableName}" WHERE "${col.name}" LIKE '%uyum%' LIMIT 5`;
                    const results = db.prepare(query).all();

                    if (results.length > 0) {
                        console.log(`\n[TABLO: ${tableName}] [SÜTUN: ${col.name}] İçerik eşleşmesi bulundu:`);
                        results.forEach(r => {
                            if (r[col.name]) console.log(` - Değer: ${r[col.name]}`);
                        });
                        foundAny = true;
                    }
                }
            } catch (e) {
                // console.error(`Hata (${tableName}.${col.name}):`, e.message);
            }
        }
    }

    if (!foundAny) {
        console.log('\n"uyumluluk" veya "uyum" ile ilgili bir şey bulunamadı.');
    }

    db.close();
} catch (error) {
    console.error('Hata:', error.message);
}
