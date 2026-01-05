const sqliteService = require('../services/sqlite.service');

function checkCustomerTable() {
    try {
        console.log('Customer Tablo Analizi:');
        const columns = sqliteService.query("PRAGMA table_info('customer')");
        console.log('Kolonlar:', columns.map(c => c.name).join(', '));

        // Tarih alanı arayalım
        const dateFields = columns.filter(c =>
            c.name.includes('date') ||
            c.name.includes('time') ||
            c.name.includes('created')
        );

        if (dateFields.length > 0) {
            console.log('Olası Tarih Alanları:', dateFields.map(c => c.name));
        } else {
            console.log('Tarih alanı bulunamadı, ID bazlı senkronizasyon yapılacak.');
        }

        const count = sqliteService.getRowCount('customer');
        console.log(`Toplam Kayıt Sayısı: ${count}`);

    } catch (error) {
        console.error('Hata:', error);
    }
}

checkCustomerTable();
