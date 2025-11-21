require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pgService = require('../services/postgresql.service');

async function setupAutoUpdateTriggers() {
  try {
    console.log('='.repeat(70));
    console.log('OTOMATIK GÜNCELLEME TRİGGER\'LARI KURULUMU');
    console.log('='.repeat(70));
    console.log();

    // 1. Ana Barkod Güncelleme Function ve Trigger
    console.log('1. Ana barkod güncelleme trigger\'ı oluşturuluyor...');
    await pgService.query(`
      CREATE OR REPLACE FUNCTION update_stok_main_barcode()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.barkod_tipi = 'ana' AND NEW.aktif = true THEN
              UPDATE stoklar 
              SET barkod = NEW.barkod,
                  guncelleme_tarihi = NOW()
              WHERE id = NEW.stok_id;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pgService.query(`DROP TRIGGER IF EXISTS trg_update_stok_main_barcode ON urun_barkodlari`);
    await pgService.query(`
      CREATE TRIGGER trg_update_stok_main_barcode
          AFTER INSERT OR UPDATE ON urun_barkodlari
          FOR EACH ROW
          EXECUTE FUNCTION update_stok_main_barcode()
    `);
    console.log('   ✓ Başarılı');

    // 2. Ana Fiyat Güncelleme Function ve Trigger
    console.log('2. Ana fiyat güncelleme trigger\'ı oluşturuluyor...');
    await pgService.query(`
      CREATE OR REPLACE FUNCTION update_stok_main_price()
      RETURNS TRIGGER AS $$
      DECLARE
          v_first_price_list_id UUID;
      BEGIN
          SELECT web_fiyat_tanimi_id INTO v_first_price_list_id
          FROM int_kodmap_fiyat_liste
          WHERE erp_liste_no = 1
          LIMIT 1;
          
          IF v_first_price_list_id IS NOT NULL AND NEW.fiyat_tanimi_id = v_first_price_list_id THEN
              UPDATE stoklar 
              SET satis_fiyati = NEW.fiyat,
                  guncelleme_tarihi = NOW()
              WHERE id = NEW.stok_id;
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pgService.query(`DROP TRIGGER IF EXISTS trg_update_stok_main_price ON urun_fiyat_listeleri`);
    await pgService.query(`
      CREATE TRIGGER trg_update_stok_main_price
          AFTER INSERT OR UPDATE ON urun_fiyat_listeleri
          FOR EACH ROW
          EXECUTE FUNCTION update_stok_main_price()
    `);
    console.log('   ✓ Başarılı');

    // 3. Barkod Silme/Pasif Function ve Trigger
    console.log('3. Barkod silme/pasif trigger\'ı oluşturuluyor...');
    await pgService.query(`
      CREATE OR REPLACE FUNCTION clear_stok_main_barcode()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.barkod_tipi = 'ana' THEN
              IF NOT EXISTS (
                  SELECT 1 FROM urun_barkodlari 
                  WHERE stok_id = OLD.stok_id 
                    AND barkod_tipi = 'ana' 
                    AND aktif = true
                    AND id != OLD.id
              ) THEN
                  UPDATE stoklar 
                  SET barkod = NULL,
                      guncelleme_tarihi = NOW()
                  WHERE id = OLD.stok_id;
              END IF;
          END IF;
          RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pgService.query(`DROP TRIGGER IF EXISTS trg_clear_stok_main_barcode ON urun_barkodlari`);
    await pgService.query(`
      CREATE TRIGGER trg_clear_stok_main_barcode
          BEFORE DELETE ON urun_barkodlari
          FOR EACH ROW
          EXECUTE FUNCTION clear_stok_main_barcode()
    `);
    console.log('   ✓ Başarılı');

    console.log();

    // Trigger'ları kontrol et
    console.log('Oluşturulan trigger\'lar kontrol ediliyor...\n');
    const triggers = await pgService.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        event_object_table
      FROM information_schema.triggers
      WHERE trigger_name IN (
        'trg_update_stok_main_barcode',
        'trg_update_stok_main_price',
        'trg_clear_stok_main_barcode'
      )
      ORDER BY event_object_table, trigger_name
    `);

    if (triggers.length > 0) {
      console.log('✓ Aktif Trigger\'lar:');
      triggers.forEach(t => {
        console.log(`  - ${t.trigger_name} (${t.event_object_table}) - ${t.event_manipulation}`);
      });
    } else {
      console.log('⚠ Hiç trigger bulunamadı!');
    }

    console.log();
    console.log('='.repeat(70));
    console.log('✓ KURULUM TAMAMLANDI!');
    console.log('='.repeat(70));
    console.log();
    console.log('Artık:');
    console.log('1. urun_barkodlari tablosuna ana barkod eklendiğinde');
    console.log('   → stoklar.barkod otomatik güncellenir');
    console.log();
    console.log('2. urun_fiyat_listeleri tablosuna fiyat eklendiğinde (liste no 1)');
    console.log('   → stoklar.satis_fiyati otomatik güncellenir');
    console.log();
    console.log('3. Ana barkod silindiğinde');
    console.log('   → stoklar.barkod otomatik temizlenir');
    console.log();

  } catch (error) {
    console.error();
    console.error('='.repeat(70));
    console.error('✗ KURULUM BAŞARISIZ!');
    console.error('='.repeat(70));
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgService.disconnect();
    process.exit(0);
  }
}

setupAutoUpdateTriggers();
