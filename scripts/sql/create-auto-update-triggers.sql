-- ============================================================================
-- OTOMATIK GÜNCELLEME TRİGGER'LARI
-- ============================================================================
-- Bu trigger'lar barkod ve fiyat eklendiğinde/güncellendiğinde
-- stoklar tablosundaki ilgili alanları otomatik günceller
-- ============================================================================

-- 1. ANA BARKOD GÜNCELLEME TRİGGER'I
-- urun_barkodlari tablosuna ana barkod eklendiğinde/güncellendiğinde
-- stoklar tablosundaki barkod alanını günceller

CREATE OR REPLACE FUNCTION update_stok_main_barcode()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece ana barkod ve aktif ise güncelle
    IF NEW.barkod_tipi = 'ana' AND NEW.aktif = true THEN
        UPDATE stoklar 
        SET barkod = NEW.barkod,
            guncelleme_tarihi = NOW()
        WHERE id = NEW.stok_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trg_update_stok_main_barcode ON urun_barkodlari;
CREATE TRIGGER trg_update_stok_main_barcode
    AFTER INSERT OR UPDATE ON urun_barkodlari
    FOR EACH ROW
    EXECUTE FUNCTION update_stok_main_barcode();

COMMENT ON TRIGGER trg_update_stok_main_barcode ON urun_barkodlari IS 
'Ana barkod eklendiğinde/güncellendiğinde stoklar tablosundaki barkod alanını günceller';

-- ============================================================================

-- 2. ANA FİYAT GÜNCELLEME TRİGGER'I
-- urun_fiyat_listeleri tablosuna fiyat eklendiğinde/güncellendiğinde
-- stoklar tablosundaki satis_fiyati alanını günceller (sadece liste no 1 için)

CREATE OR REPLACE FUNCTION update_stok_main_price()
RETURNS TRIGGER AS $$
DECLARE
    v_first_price_list_id UUID;
BEGIN
    -- İlk fiyat listesinin ID'sini al (ERP liste no 1)
    SELECT web_fiyat_tanimi_id INTO v_first_price_list_id
    FROM int_kodmap_fiyat_liste
    WHERE erp_liste_no = 1
    LIMIT 1;
    
    -- Eğer bu fiyat ilk fiyat listesine aitse, stoklar tablosunu güncelle
    IF v_first_price_list_id IS NOT NULL AND NEW.fiyat_tanimi_id = v_first_price_list_id THEN
        UPDATE stoklar 
        SET satis_fiyati = NEW.fiyat,
            guncelleme_tarihi = NOW()
        WHERE id = NEW.stok_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trg_update_stok_main_price ON urun_fiyat_listeleri;
CREATE TRIGGER trg_update_stok_main_price
    AFTER INSERT OR UPDATE ON urun_fiyat_listeleri
    FOR EACH ROW
    EXECUTE FUNCTION update_stok_main_price();

COMMENT ON TRIGGER trg_update_stok_main_price ON urun_fiyat_listeleri IS 
'Ana fiyat listesi (liste no 1) güncellendiğinde stoklar tablosundaki satis_fiyati alanını günceller';

-- ============================================================================

-- 3. BARKOD SİLİNDİĞİNDE GÜNCELLEME
-- Ana barkod silindiğinde veya pasif yapıldığında stoklar tablosundaki barkodu temizle

CREATE OR REPLACE FUNCTION clear_stok_main_barcode()
RETURNS TRIGGER AS $$
BEGIN
    -- Eğer silinen/pasif yapılan ana barkod ise
    IF OLD.barkod_tipi = 'ana' THEN
        -- Başka aktif ana barkod var mı kontrol et
        IF NOT EXISTS (
            SELECT 1 FROM urun_barkodlari 
            WHERE stok_id = OLD.stok_id 
              AND barkod_tipi = 'ana' 
              AND aktif = true
              AND id != OLD.id
        ) THEN
            -- Yoksa stoklar tablosundaki barkodu temizle
            UPDATE stoklar 
            SET barkod = NULL,
                guncelleme_tarihi = NOW()
            WHERE id = OLD.stok_id;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trg_clear_stok_main_barcode ON urun_barkodlari;
CREATE TRIGGER trg_clear_stok_main_barcode
    AFTER DELETE OR UPDATE ON urun_barkodlari
    FOR EACH ROW
    WHEN (OLD.barkod_tipi = 'ana' AND (TG_OP = 'DELETE' OR NEW.aktif = false))
    EXECUTE FUNCTION clear_stok_main_barcode();

COMMENT ON TRIGGER trg_clear_stok_main_barcode ON urun_barkodlari IS 
'Ana barkod silindiğinde veya pasif yapıldığında stoklar tablosundaki barkodu temizler';

-- ============================================================================

-- TEST SORULARI
-- ============================================================================

-- Trigger'ların oluşturulduğunu kontrol et
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name IN (
    'trg_update_stok_main_barcode',
    'trg_update_stok_main_price',
    'trg_clear_stok_main_barcode'
)
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- KULLANIM ÖRNEKLERİ
-- ============================================================================

/*
-- Örnek 1: Ana barkod ekleme (otomatik olarak stoklar tablosunu günceller)
INSERT INTO urun_barkodlari (stok_id, barkod, barkod_tipi, aktif)
VALUES ('stok-uuid-buraya', '1234567890123', 'ana', true);

-- Örnek 2: Fiyat ekleme (liste no 1 ise otomatik olarak stoklar tablosunu günceller)
INSERT INTO urun_fiyat_listeleri (stok_id, fiyat_tanimi_id, fiyat)
VALUES ('stok-uuid-buraya', 'fiyat-tanimi-uuid-buraya', 99.99);

-- Örnek 3: Barkod güncelleme
UPDATE urun_barkodlari 
SET barkod = '9876543210987'
WHERE id = 'barkod-uuid-buraya';

-- Örnek 4: Fiyat güncelleme
UPDATE urun_fiyat_listeleri 
SET fiyat = 149.99
WHERE id = 'fiyat-uuid-buraya';

-- Örnek 5: Barkod silme (otomatik olarak stoklar tablosundaki barkodu temizler)
DELETE FROM urun_barkodlari WHERE id = 'barkod-uuid-buraya';
*/
