require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('Bankalar tablosuna eksik sütunlar ekleniyor...');

        // ban_kod sütunu ekle
        await pgService.query(`
      ALTER TABLE bankalar 
      ADD COLUMN IF NOT EXISTS ban_kod TEXT;
    `);
        console.log('✓ ban_kod sütunu eklendi');

        // erp_grup_no sütunu ekle
        await pgService.query(`
      ALTER TABLE bankalar 
      ADD COLUMN IF NOT EXISTS erp_grup_no INTEGER DEFAULT 0;
    `);
        console.log('✓ erp_grup_no sütunu eklendi');

        // erp_recno sütunu ekle
        await pgService.query(`
      ALTER TABLE bankalar 
      ADD COLUMN IF NOT EXISTS erp_recno INTEGER;
    `);
        console.log('✓ erp_recno sütunu eklendi');

        // İndeks ekle
        await pgService.query(`
      CREATE INDEX IF NOT EXISTS idx_bankalar_ban_kod ON bankalar(ban_kod);
    `);
        console.log('✓ İndeks eklendi');

        console.log();
        console.log('Tüm değişiklikler başarıyla uygulandı!');

        await pgService.disconnect();
    } catch (err) {
        console.error('Hata:', err);
        process.exit(1);
    }
})();
