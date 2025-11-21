require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
  try {
    await pgService.query(`DROP TRIGGER IF EXISTS trg_clear_stok_main_barcode ON urun_barkodlari`);
    
    await pgService.query(`
      CREATE OR REPLACE FUNCTION clear_stok_main_barcode()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.barkod_tipi = 'ana' THEN
              UPDATE stoklar 
              SET barkod = NULL,
                  guncelleme_tarihi = NOW()
              WHERE id = OLD.stok_id 
                AND NOT EXISTS (
                    SELECT 1 FROM urun_barkodlari 
                    WHERE stok_id = OLD.stok_id 
                      AND barkod_tipi = 'ana' 
                      AND aktif = true
                      AND id != OLD.id
                );
          END IF;
          RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await pgService.query(`
      CREATE TRIGGER trg_clear_stok_main_barcode
          AFTER DELETE ON urun_barkodlari
          FOR EACH ROW
          EXECUTE FUNCTION clear_stok_main_barcode()
    `);
    
    console.log('✓ Trigger güncellendi');
    await pgService.disconnect();
  } catch (error) {
    console.error('Hata:', error.message);
    await pgService.disconnect();
  }
})();
