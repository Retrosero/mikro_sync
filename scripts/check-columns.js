const mssql = require('../services/mssql.service');

async function checkColumns() {
    try {
        console.log('Checking STOK_HAREKETLERI columns...');
        const stokResult = await mssql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'STOK_HAREKETLERI' AND COLUMN_NAME LIKE 'sth_%' ORDER BY COLUMN_NAME");
        console.log('STOK_HAREKETLERI Columns:', stokResult.map(c => c.COLUMN_NAME).join(', '));

        console.log('\nChecking CARI_HESAP_HAREKETLERI columns...');
        const cariResult = await mssql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CARI_HESAP_HAREKETLERI' AND COLUMN_NAME LIKE 'cha_%' ORDER BY COLUMN_NAME");
        console.log('CARI_HESAP_HAREKETLERI Columns:', cariResult.map(c => c.COLUMN_NAME).join(', '));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkColumns();
