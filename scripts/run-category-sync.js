require('dotenv').config();
const categorySyncService = require('../services/category-sync.service');
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function main() {
  try {
    const result = await categorySyncService.syncCategories({ forceFull: true });

    console.log('Kategori tam yenileme tamamlandı.');
    console.log(
      `Yeni: ${result.insertedCount}, Güncellenen: ${result.updatedCount}, Stok kategori bağı: ${result.stockCategoryUpdateCount}`
    );
  } catch (error) {
    console.error('Kategori tam yenileme başarısız:', error.message);
    process.exitCode = 1;
  } finally {
    await pgService.disconnect();
    await mssqlService.disconnect();
  }
}

main();
