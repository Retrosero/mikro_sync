require('dotenv').config();
const mssqlService = require('./services/mssql.service');

(async () => {
    try {
        console.log('İndeks bilgileri sorgulanıyor...\n');

        const indexInfo = await mssqlService.query(`
      SELECT 
        i.name AS IndexName,
        c.name AS ColumnName,
        ic.key_ordinal AS ColumnOrder,
        i.is_unique
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('CARI_HESAP_HAREKETLERI_OZET')
      AND i.name = 'NDX_CARI_HESAP_HAREKETLERI_OZET_01'
      ORDER BY ic.key_ordinal;
    `);

        console.log('İndeks Sütunları:');
        indexInfo.forEach(row => {
            console.log(`${row.ColumnOrder}. ${row.ColumnName} (Unique: ${row.is_unique})`);
        });

        await mssqlService.disconnect();
    } catch (err) {
        console.error('Hata:', err);
        process.exit(1);
    }
})();
