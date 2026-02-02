/**
 * Excel'den product_compatibles tablosuna veri aktarımı
 * 
 * Excel Yapısı:
 * - A Sütunu: urunkodu (product_id bulunacak)
 * - B Sütunu: alan1
 * - C Sütunu: alan2
 * - D Sütunu: alan3
 */

const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

const excelPath = path.join(__dirname, '..', 'uyum.xlsx');
const dbPath = 'C:\\Ana Entegra\\db.s3db';

console.log('='.repeat(60));
console.log('EXCEL → PRODUCT_COMPATIBLES AKTARIM');
console.log('='.repeat(60));

try {
    // Excel dosyasını oku
    console.log('\n1. Excel dosyası okunuyor...');
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    console.log(`   ✓ ${data.length} satır okundu (başlık dahil)`);

    // Veritabanı bağlantısı
    console.log('\n2. Veritabanı bağlantısı açılıyor...');
    const db = new Database(dbPath, { readonly: false });
    console.log('   ✓ Bağlantı başarılı');

    // Product tablosundan productCode -> product_id mapping oluştur
    console.log('\n3. Ürün kodları eşleştiriliyor...');
    const productMap = new Map();
    const products = db.prepare('SELECT id, productCode FROM product').all();
    products.forEach(p => {
        if (p.productCode) {
            productMap.set(p.productCode.toString().trim(), p.id);
        }
    });
    console.log(`   ✓ ${productMap.size} ürün kodu eşleştirildi`);

    // Prepared statement
    const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO product_compatibles 
        (product_id, alan1, alan2, alan3, sync, status, date_change)
        VALUES (?, ?, ?, ?, 0, 1, datetime('now'))
    `);

    const updateStmt = db.prepare(`
        UPDATE product_compatibles 
        SET alan1 = ?, alan2 = ?, alan3 = ?, date_change = datetime('now')
        WHERE product_id = ?
    `);

    // Verileri işle
    console.log('\n4. Veriler aktarılıyor...');
    let successCount = 0;
    let updateCount = 0;
    let insertCount = 0;
    let notFoundCount = 0;
    const notFoundProducts = [];

    // Transaction başlat
    const transaction = db.transaction((rows) => {
        for (let i = 1; i < rows.length; i++) { // Başlık satırını atla
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const urunkodu = row[0] ? row[0].toString().trim() : '';
            const alan1 = row[1] !== undefined && row[1] !== null && row[1] !== '' && row[1] !== ' ' ? row[1].toString() : '';
            const alan2 = row[2] !== undefined && row[2] !== null && row[2] !== '' && row[2] !== ' ' ? row[2].toString() : '';
            const alan3 = row[3] !== undefined && row[3] !== null && row[3] !== '' && row[3] !== ' ' ? row[3].toString() : '';

            if (!urunkodu) continue;

            // Product ID bul
            const productId = productMap.get(urunkodu);

            if (!productId) {
                notFoundCount++;
                notFoundProducts.push(urunkodu);
                continue;
            }

            // Kayıt var mı kontrol et
            const existing = db.prepare('SELECT id FROM product_compatibles WHERE product_id = ?').get(productId);

            try {
                if (existing) {
                    // Güncelle
                    updateStmt.run(alan1, alan2, alan3, productId);
                    updateCount++;
                } else {
                    // Yeni ekle
                    insertStmt.run(productId, alan1, alan2, alan3);
                    insertCount++;
                }
                successCount++;
            } catch (err) {
                console.error(`   ✗ Hata (${urunkodu}):`, err.message);
            }
        }
    });

    transaction(data);

    // Sonuçları göster
    console.log('\n' + '='.repeat(60));
    console.log('SONUÇ');
    console.log('='.repeat(60));
    console.log(`✓ Toplam işlenen satır: ${data.length - 1}`);
    console.log(`✓ Başarılı: ${successCount}`);
    console.log(`  - Yeni eklenen: ${insertCount}`);
    console.log(`  - Güncellenen: ${updateCount}`);
    console.log(`✗ Ürün bulunamadı: ${notFoundCount}`);

    if (notFoundProducts.length > 0 && notFoundProducts.length <= 20) {
        console.log('\nBulunamayan ürün kodları:');
        notFoundProducts.forEach(code => console.log(`  - ${code}`));
    } else if (notFoundProducts.length > 20) {
        console.log('\nBulunamayan ürün kodları (ilk 20):');
        notFoundProducts.slice(0, 20).forEach(code => console.log(`  - ${code}`));
        console.log(`  ... ve ${notFoundProducts.length - 20} tane daha`);
    }

    db.close();
    console.log('\n✓ İşlem tamamlandı!');

} catch (error) {
    console.error('\n✗ HATA:', error.message);
    console.error(error.stack);
    process.exit(1);
}
