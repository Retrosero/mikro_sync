const mssqlService = require('../services/mssql.service');

async function checkFiyatListeColumns() {
    try {
        console.log('STOK_SATIS_FIYAT_LISTE_TANIMLARI tablosu kontrol ediliyor...\n');

        const result = await mssqlService.query(`
      SELECT TOP 1 * FROM STOK_SATIS_FIYAT_LISTE_TANIMLARI
    `);

        if (result.length > 0) {
            console.log('Mevcut kolonlar:');
            console.log(Object.keys(result[0]).join(', '));
            console.log('\nÖrnek veri:');
            console.log(result[0]);
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkFiyatListeColumns();
