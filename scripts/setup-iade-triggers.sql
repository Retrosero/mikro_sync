
-- Mapping table
CREATE TABLE IF NOT EXISTS int_iade_mapping (
    web_iade_id UUID PRIMARY KEY,
    erp_evrak_seri VARCHAR(10),
    erp_evrak_no INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
    -- iadeler tablosuna kaynak kolonu ekle
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'iadeler') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'iadeler' AND column_name = 'kaynak') THEN
            ALTER TABLE iadeler ADD COLUMN kaynak VARCHAR(20) DEFAULT 'web';
            RAISE NOTICE 'iadeler tablosuna kaynak alanı eklendi';
        END IF;
    END IF;
END $$;

-- 1. Sync Queue Trigger
CREATE OR REPLACE FUNCTION notify_iade_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
        INSERT INTO sync_queue (entity_type, entity_id, operation, status)
        VALUES ('iade', NEW.id, TG_OP, 'pending');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS iade_sync_trigger ON iadeler;
CREATE TRIGGER iade_sync_trigger
AFTER INSERT OR UPDATE ON iadeler
FOR EACH ROW EXECUTE FUNCTION notify_iade_sync();

-- 2. Internal Sync: İade -> Cari Hareket
CREATE OR REPLACE FUNCTION sync_iade_to_cari_hareket()
RETURNS TRIGGER AS $$
DECLARE
    v_onceki_bakiye NUMERIC;
    v_sonraki_bakiye NUMERIC;
    v_hareket_turu VARCHAR(50);
BEGIN
    IF NEW.iade_sekli = 'nakit' THEN v_hareket_turu := 'Kasadan K.';
    ELSIF NEW.iade_sekli = 'havale' THEN v_hareket_turu := 'Bankadan K.';
    ELSE v_hareket_turu := 'Açık Hesap';
    END IF;

    SELECT bakiye INTO v_onceki_bakiye FROM cari_hesaplar WHERE id = NEW.cari_hesap_id;
    IF v_onceki_bakiye IS NULL THEN v_onceki_bakiye := 0; END IF;
    
    -- Satış iadesi müşterinin borcunu düşürür (bizim alacağımızı düşürür)
    v_sonraki_bakiye := v_onceki_bakiye - NEW.toplam_tutar;

    UPDATE cari_hesaplar SET bakiye = v_sonraki_bakiye WHERE id = NEW.cari_hesap_id;

    INSERT INTO cari_hesap_hareketleri (
        cari_hesap_id, islem_tarihi, hareket_tipi, tutar,
        onceki_bakiye, sonraki_bakiye, belge_no, aciklama,
        hareket_turu, referans_id, belge_tipi, created_at, updated_at
    ) VALUES (
        NEW.cari_hesap_id,
        NEW.iade_tarihi,
        'satis_iade',
        NEW.toplam_tutar,
        v_onceki_bakiye,
        v_sonraki_bakiye,
        NEW.iade_no,
        'Satış İadesi',
        v_hareket_turu,
        NEW.id,
        'iade',
        NOW(),
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_iade_to_cari_hareket ON iadeler;
CREATE TRIGGER trg_iade_to_cari_hareket
AFTER INSERT ON iadeler
FOR EACH ROW EXECUTE FUNCTION sync_iade_to_cari_hareket();

-- 3. Internal Sync: İade Kalem -> Stok Hareket
CREATE OR REPLACE FUNCTION sync_iade_kalem_to_stok_hareket()
RETURNS TRIGGER AS $$
DECLARE
    v_iade_no VARCHAR(50);
    v_cari_hesap_id UUID;
    v_iade_tarihi DATE;
BEGIN
    SELECT iade_no, cari_hesap_id, iade_tarihi 
    INTO v_iade_no, v_cari_hesap_id, v_iade_tarihi
    FROM iadeler WHERE id = NEW.iade_id;

    UPDATE stoklar SET eldeki_miktar = COALESCE(eldeki_miktar, 0) + NEW.miktar WHERE id = NEW.stok_id;

    INSERT INTO stok_hareketleri (
        stok_id, hareket_tipi, miktar, belge_no, islem_tarihi,
        cari_hesap_id, referans_id, 
        birim_fiyat, toplam_tutar,
        olusturma_tarihi
    ) VALUES (
        NEW.stok_id,
        'giris', -- Satış İadesi giriştir
        NEW.miktar,
        v_iade_no,
        COALESCE(v_iade_tarihi, NOW()),
        v_cari_hesap_id,
        NEW.iade_id,
        NEW.birim_fiyat,
        NEW.toplam_tutar,
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_iade_kalem_to_stok_hareket ON iade_kalemleri;
CREATE TRIGGER trg_iade_kalem_to_stok_hareket
AFTER INSERT ON iade_kalemleri
FOR EACH ROW EXECUTE FUNCTION sync_iade_kalem_to_stok_hareket();
