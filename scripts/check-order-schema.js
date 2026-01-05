const db = require('better-sqlite3')('C:\\Ana Entegra\\db.s3db', { readonly: true });
const cols = db.prepare("PRAGMA table_info('order')").all();

// invoice_print alanını bul
const hasInvoicePrint = cols.find(c => c.name === 'invoice_print');
if (hasInvoicePrint) {
    console.log('invoice_print alanı MEVCUT');
    console.log(JSON.stringify(hasInvoicePrint, null, 2));

    // invoice_print değerleri için örnek veri
    const samples = db.prepare("SELECT id, no, invoice_print FROM 'order' WHERE invoice_print IS NOT NULL LIMIT 5").all();
    console.log('\nÖrnek veriler:');
    console.log(JSON.stringify(samples, null, 2));
} else {
    console.log('invoice_print alanı YOK');
    console.log('\nMevcut kolonlar (ilk 30):');
    cols.slice(0, 30).forEach(c => console.log(c.name));
}

// Toplam sayı
console.log('\nToplam kolon sayısı:', cols.length);
db.close();
