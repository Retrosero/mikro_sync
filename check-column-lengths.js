require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkColumnLengths() {
    try {
        console.log('Kolon uzunlukları sorgulanıyor...\n');

        const query = `
            SELECT 
                TABLE_NAME, 
                COLUMN_NAME, 
                DATA_TYPE, 
                CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME IN ('CARI_HESAP_HAREKETLERI', 'STOK_HAREKETLERI')
            AND COLUMN_NAME IN ('cha_special1', 'sth_special1', 'cha_aciklama', 'sth_aciklama')
            ORDER BY TABLE_NAME, COLUMN_NAME
        `;

        const result = await mssqlService.query(query);
        console.table(result);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkColumnLengths();
