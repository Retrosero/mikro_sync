require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkTableColumns() {
  try {
    await mssqlService.connect();
    
    console.log('=== CARI_HESAP_HAREKETLERI Kolonları ===\n');
    const chaColumns = await mssqlService.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'CARI_HESAP_HAREKETLERI'
      AND COLUMN_NAME LIKE 'cha_%'
      ORDER BY ORDINAL_POSITION
    `);
    
    chaColumns.forEach(col => {
      console.log(`${col.COLUMN_NAME} (${col.DATA_TYPE}) - NULL: ${col.IS_NULLABLE}`);
    });
    
    console.log('\n=== STOK_HAREKETLERI Kolonları ===\n');
    const sthColumns = await mssqlService.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'STOK_HAREKETLERI'
      AND COLUMN_NAME LIKE 'sth_malkbl%'
      ORDER BY ORDINAL_POSITION
    `);
    
    sthColumns.forEach(col => {
      console.log(`${col.COLUMN_NAME} (${col.DATA_TYPE}) - NULL: ${col.IS_NULLABLE}`);
    });
    
    await mssqlService.disconnect();
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

checkTableColumns();
