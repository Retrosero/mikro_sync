-- =====================================================
-- BARKOD SENKRONIZASYON TRİGGER'I (Web -> ERP)
-- =====================================================
-- Bu script PostgreSQL'de urun_barkodlari tablosunda değişiklik olduğunda
-- sync_queue tablosuna kayıt ekleyen trigger'ı oluşturur.
-- =====================================================

-- 1. Barkod Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION notify_barkod_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Yeni kayıt veya güncelleme durumunda
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Aynı entity için bekleyen kayıt var mı kontrol et (duplicate önleme)
        IF NOT EXISTS (
            SELECT 1 FROM sync_queue 
            WHERE entity_type = 'urun_barkodlari' 
            AND entity_id = NEW.id 
            AND status = 'pending'
        ) THEN
            INSERT INTO sync_queue (entity_type, entity_id, operation, status)
            VALUES ('urun_barkodlari', NEW.id, TG_OP, 'pending');
        END IF;
        RETURN NEW;
    END IF;

    -- Silme durumunda
    IF TG_OP = 'DELETE' THEN
        -- Silinen barkod için sync_queue'ya kayıt ekle
        INSERT INTO sync_queue (entity_type, entity_id, operation, status)
        VALUES ('urun_barkodlari', OLD.id, 'DELETE', 'pending');
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Mevcut trigger'ı temizle ve yeniden oluştur
DO $$
BEGIN
    -- Mevcut trigger'ı düşür (varsa)
    DROP TRIGGER IF EXISTS urun_barkodlari_sync_trigger ON urun_barkodlari;
    
    -- Yeni trigger oluştur
    CREATE TRIGGER urun_barkodlari_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON urun_barkodlari
    FOR EACH ROW EXECUTE FUNCTION notify_barkod_sync();
    
    RAISE NOTICE 'urun_barkodlari_sync_trigger başarıyla oluşturuldu';
END $$;

-- 3. Trigger'ın çalıştığını doğrula
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'urun_barkodlari_sync_trigger'
        AND event_object_table = 'urun_barkodlari'
    ) THEN
        RAISE NOTICE '✓ Barkod sync trigger aktif!';
    ELSE
        RAISE WARNING '✗ Barkod sync trigger oluşturulamadı!';
    END IF;
END $$;

-- =====================================================
-- KULLANIM NOTU:
-- Bu script'i Supabase SQL Editor'da veya psql ile çalıştırın.
-- Çalıştırdıktan sonra urun_barkodlari tablosunda yapılan 
-- değişiklikler otomatik olarak sync_queue'ya eklenir.
-- =====================================================
