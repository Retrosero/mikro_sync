-- =====================================================
-- WEB -> ERP STOK HAREKET (SAYIM) TRIGGER
-- =====================================================

-- 1. Stok Hareket Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION notify_stok_hareket_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece Web'den oluşturulan (erp_recno IS NULL) ve belge_tipi = 'sayim' olanlar için sync yap
    IF (NEW.erp_recno IS NULL OR NEW.erp_recno = 0) AND NEW.belge_tipi = 'sayim' THEN
        -- Kuyrukta zaten beklemede olan aynı ID'li kayıt varsa tekrar ekleme
        IF NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type = 'stok_hareket' AND entity_id = NEW.id AND status = 'pending') THEN
            INSERT INTO sync_queue (entity_type, entity_id, operation, status)
            VALUES ('stok_hareket', NEW.id, TG_OP, 'pending');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Stok Hareket Tablosu için Trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stok_hareketleri') THEN
        DROP TRIGGER IF EXISTS stok_hareket_sync_trigger ON stok_hareketleri;
        
        CREATE TRIGGER stok_hareket_sync_trigger
        AFTER INSERT OR UPDATE ON stok_hareketleri
        FOR EACH ROW EXECUTE FUNCTION notify_stok_hareket_sync();
        
        RAISE NOTICE 'Stok Hareket (Sayım) trigger oluşturuldu';
    ELSE
        RAISE NOTICE 'stok_hareketleri tablosu bulunamadı, trigger oluşturulmadı';
    END IF;
END $$;
