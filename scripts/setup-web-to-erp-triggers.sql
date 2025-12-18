-- =====================================================
-- WEB -> ERP SENKRONIZASYON TRİGGER'LARI
-- =====================================================

-- 1. Sync Queue Tablosu (eğer yoksa oluştur)
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    INDEX idx_sync_queue_status (status, created_at),
    INDEX idx_sync_queue_entity (entity_type, entity_id)
);

-- 2. Satış Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION notify_satis_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece Web'den oluşturulan satışlar için sync yap
    -- (ERP'den gelen kayıtları tekrar ERP'ye gönderme)
    IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
        INSERT INTO sync_queue (entity_type, entity_id, operation, status)
        VALUES ('satis', NEW.id, TG_OP, 'pending');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Tahsilat Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION notify_tahsilat_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece Web'den oluşturulan tahsilatlar için sync yap
    IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
        INSERT INTO sync_queue (entity_type, entity_id, operation, status)
        VALUES ('tahsilat', NEW.id, TG_OP, 'pending');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Satış Tablosu için Trigger (eğer satislar tablosu varsa)
-- NOT: Tablo adını projenize göre ayarlayın
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'satislar') THEN
        DROP TRIGGER IF EXISTS satis_sync_trigger ON satislar;
        CREATE TRIGGER satis_sync_trigger
        AFTER INSERT OR UPDATE ON satislar
        FOR EACH ROW EXECUTE FUNCTION notify_satis_sync();
        
        RAISE NOTICE 'Satış trigger oluşturuldu';
    ELSE
        RAISE NOTICE 'satislar tablosu bulunamadı, trigger oluşturulmadı';
    END IF;
END $$;

-- 5. Tahsilat Tablosu için Trigger (eğer tahsilatlar tablosu varsa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tahsilatlar') THEN
        DROP TRIGGER IF EXISTS tahsilat_sync_trigger ON tahsilatlar;
        CREATE TRIGGER tahsilat_sync_trigger
        AFTER INSERT OR UPDATE ON tahsilatlar
        FOR EACH ROW EXECUTE FUNCTION notify_tahsilat_sync();
        
        RAISE NOTICE 'Tahsilat trigger oluşturuldu';
    ELSE
        RAISE NOTICE 'tahsilatlar tablosu bulunamadı, trigger oluşturulmadı';
    END IF;
END $$;

-- 6. Alış Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION notify_alis_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece Web'den oluşturulan alışlar için sync yap
    IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
        INSERT INTO sync_queue (entity_type, entity_id, operation, status)
        VALUES ('alislar', NEW.id, TG_OP, 'pending');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Alış Tablosu için Trigger (eğer alislar tablosu varsa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alislar') THEN
        DROP TRIGGER IF EXISTS alis_sync_trigger ON alislar;
        CREATE TRIGGER alis_sync_trigger
        AFTER INSERT OR UPDATE ON alislar
        FOR EACH ROW EXECUTE FUNCTION notify_alis_sync();
        
        RAISE NOTICE 'Alış trigger oluşturuldu';
    ELSE
        RAISE NOTICE 'alislar tablosu bulunamadı, trigger oluşturulmadı';
    END IF;
END $$;

-- 8. Kaynak alanı ekle (eğer yoksa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'satislar') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'satislar' AND column_name = 'kaynak') THEN
            ALTER TABLE satislar ADD COLUMN kaynak VARCHAR(20) DEFAULT 'web';
            RAISE NOTICE 'satislar tablosuna kaynak alanı eklendi';
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tahsilatlar') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'tahsilatlar' AND column_name = 'kaynak') THEN
            ALTER TABLE tahsilatlar ADD COLUMN kaynak VARCHAR(20) DEFAULT 'web';
            RAISE NOTICE 'tahsilatlar tablosuna kaynak alanı eklendi';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alislar') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'alislar' AND column_name = 'kaynak') THEN
            ALTER TABLE alislar ADD COLUMN kaynak VARCHAR(20) DEFAULT 'web';
            RAISE NOTICE 'alislar tablosuna kaynak alanı eklendi';
        END IF;
    END IF;
END $$;

-- 9. Başarılı kurulum mesajı
DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Web -> ERP Sync Trigger''ları başarıyla kuruldu!';
    RAISE NOTICE '================================================';
END $$;
