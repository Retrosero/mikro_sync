require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkIndexDefinition() {
    try {
        console.log('NDX_STOK_HAREKETLERI_05 index tanımı sorgulanıyor...\n');

        const query = `
            SELECT 
                i.name AS IndexName,
                c.name AS ColumnName,
                ic.key_ordinal AS KeyOrdinal
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE i.name = 'NDX_STOK_HAREKETLERI_05'
            AND OBJECT_NAME(i.object_id) = 'STOK_HAREKETLERI'
            ORDER BY ic.key_ordinal;
        `;

        const result = await mssqlService.query(query);
        console.table(result);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkIndexDefinition();
