const pgService = require('../services/postgresql.service');

async function addErpRecno() {
    try {
        // cari_hesap_hareketleri
        await pgService.query(`
      ALTER TABLE cari_hesap_hareketleri 
      ADD COLUMN IF NOT EXISTS erp_recno INTEGER;
    `);

        await pgService.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'cari_hesap_hareketleri_erp_recno_key'
        ) THEN
          ALTER TABLE cari_hesap_hareketleri ADD CONSTRAINT cari_hesap_hareketleri_erp_recno_key UNIQUE (erp_recno);
        END IF;
      END $$;
    `);
        console.log('cari_hesap_hareketleri: erp_recno added and unique constraint set.');

        // stok_hareketleri
        await pgService.query(`
      ALTER TABLE stok_hareketleri 
      ADD COLUMN IF NOT EXISTS erp_recno INTEGER;
    `);

        await pgService.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'stok_hareketleri_erp_recno_key'
        ) THEN
          ALTER TABLE stok_hareketleri ADD CONSTRAINT stok_hareketleri_erp_recno_key UNIQUE (erp_recno);
        END IF;
      END $$;
    `);
        console.log('stok_hareketleri: erp_recno added and unique constraint set.');

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

addErpRecno();
