require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function updateKdvMapping() {
    try {
        console.log('KDV Pointer Mapping guncelleniyor...\n');

        // Önce tabloyu temizle
        await mssqlService.query('DELETE FROM INT_KdvPointerMap');
        console.log('Eski veriler silindi.');

        // Yeni mapping'i ekle
        await mssqlService.query(`
            INSERT INTO INT_KdvPointerMap (kdv_oran, vergi_pntr) VALUES
            (0, 1),   -- %0 = YOK
            (1, 2),   -- %1 = VERGI %1
            (10, 3),  -- %10 = VERGI %10
            (20, 4),  -- %20 = VERGI %20
            (26, 5)   -- %26 = VERGI %26
        `);

        console.log('Yeni mapping eklendi!\n');

        // Kontrol
        const data = await mssqlService.query('SELECT * FROM INT_KdvPointerMap ORDER BY kdv_oran');
        console.log('Guncel mapping:');
        console.table(data);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

updateKdvMapping();
