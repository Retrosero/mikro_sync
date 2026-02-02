const Database = require('better-sqlite3');
const dbPath = 'C:\\Ana Entegra\\db.s3db';

try {
    const db = new Database(dbPath, { readonly: true });

    // Tablo var mı kontrol et
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_compatibles'").get();

    if (tableExists) {
        console.log('✓ product_compatibles tablosu mevcut');

        // Tablo yapısını göster
        const columns = db.prepare("PRAGMA table_info('product_compatibles')").all();
        console.log('\nTablo Yapısı:');
        columns.forEach(c => console.log(`  - ${c.name} (${c.type})${c.pk ? ' [PK]' : ''}${c.notnull ? ' [NOT NULL]' : ''}`));

        // Mevcut kayıt sayısı
        const count = db.prepare("SELECT COUNT(*) as cnt FROM product_compatibles").get();
        console.log(`\nMevcut kayıt sayısı: ${count.cnt}`);

        // Örnek kayıt
        if (count.cnt > 0) {
            const sample = db.prepare("SELECT * FROM product_compatibles LIMIT 3").all();
            console.log('\nÖrnek kayıtlar:');
            sample.forEach(s => console.log(s));
        }
    } else {
        console.log('✗ product_compatibles tablosu bulunamadı!');
        console.log('\nMevcut tablolar (ilk 50):');
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 50").all();
        tables.forEach(t => console.log(`  - ${t.name}`));
    }

    db.close();
} catch (e) {
    console.error('Hata:', e.message);
}
