-- =====================================================
-- CARİ HESAPLAR WEB -> ERP SENKRONIZASYON TRIGGER'I
-- =====================================================

-- 1. Kaynak alanı ekle (eğer yoksa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cari_hesaplar') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'cari_hesaplar' AND column_name = 'kaynak') THEN
            ALTER TABLE cari_hesaplar ADD COLUMN kaynak VARCHAR(20) DEFAULT 'web';
            RAISE NOTICE 'cari_hesaplar tablosuna kaynak alanı eklendi';
        END IF;
    ELSE
        RAISE NOTICE 'cari_hesaplar tablosu bulunamadı!';
    END IF;
END $$;

-- 2. Cari Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION notify_cari_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece Web'den oluşturulan/güncellenen cariler için sync yap
    -- (ERP'den gelen kayıtları tekrar ERP'ye gönderme)
    IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
        INSERT INTO sync_queue (entity_type, entity_id, operation, status)
        VALUES ('cari', NEW.id, TG_OP, 'pending');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Cari Tablosu için Trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cari_hesaplar') THEN
        DROP TRIGGER IF EXISTS cari_sync_trigger ON cari_hesaplar;
        
        CREATE TRIGGER cari_sync_trigger
        AFTER INSERT OR UPDATE ON cari_hesaplar
        FOR EACH ROW EXECUTE FUNCTION notify_cari_sync();
        
        RAISE NOTICE 'Cari sync trigger oluşturuldu';
    END IF;
END $$;
