-- Satislar tablosu icin sync trigger'larini olustur

-- 1. Eski trigger'lari kaldir (varsa)
DROP TRIGGER IF EXISTS trigger_satislar_sync ON satislar;
DROP TRIGGER IF EXISTS trigger_satislar_sync_unified ON satislar;
DROP TRIGGER IF EXISTS notify_satis_sync_trigger ON satislar;

-- 2. Fonksiyon zaten varsa kullan, yoksa olustur
-- notify_satis_sync fonksiyonu zaten var, onu kullanacagiz

-- 3. Satislar tablosu icin INSERT trigger
CREATE TRIGGER trigger_satislar_sync_insert
    AFTER INSERT ON satislar
    FOR EACH ROW
    EXECUTE FUNCTION notify_satis_sync();

-- 4. Satislar tablosu icin UPDATE trigger
CREATE TRIGGER trigger_satislar_sync_update
    AFTER UPDATE ON satislar
    FOR EACH ROW
    EXECUTE FUNCTION notify_satis_sync();

-- 5. Satis kalemleri tablosu icin trigger'lari kontrol et
-- Once satis_kalemleri tablosundaki trigger'lari kontrol edelim

-- Satis kalemleri icin fonksiyon olustur (yoksa)
CREATE OR REPLACE FUNCTION notify_satis_kalemi_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
        INSERT INTO sync_queue (entity_type, entity_id, operation, status, record_data)
        VALUES ('satis_kalemi', NEW.id, TG_OP, 'pending',
            json_build_object(
                'satis_id', NEW.satis_id,
                'stok_id', NEW.stok_id,
                'miktar', NEW.miktar,
                'birim_fiyat', NEW.birim_fiyat
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Satis kalemleri trigger'larini olustur
DROP TRIGGER IF EXISTS trigger_satis_kalemleri_sync ON satis_kalemleri;
DROP TRIGGER IF EXISTS trigger_satis_kalemleri_sync_insert ON satis_kalemleri;
DROP TRIGGER IF EXISTS trigger_satis_kalemleri_sync_update ON satis_kalemleri;

CREATE TRIGGER trigger_satis_kalemleri_sync_insert
    AFTER INSERT ON satis_kalemleri
    FOR EACH ROW
    EXECUTE FUNCTION notify_satis_kalemi_sync();

CREATE TRIGGER trigger_satis_kalemleri_sync_update
    AFTER UPDATE ON satis_kalemleri
    FOR EACH ROW
    EXECUTE FUNCTION notify_satis_kalemi_sync();

-- 6. Mevcut aktarilmamis satislari sync_queue'ya ekle
INSERT INTO sync_queue (entity_type, entity_id, operation, status, record_data)
SELECT
    'satis',
    s.id,
    'INSERT',
    'pending',
    json_build_object(
        'fatura_no', s.satis_no,
        'seri', s.fatura_seri_no,
        'sira', s.fatura_sira_no,
        'erp_rec_no', s.erp_rec_no
    )
FROM satislar s
LEFT JOIN int_satis_mapping m ON s.id = m.web_satis_id
WHERE m.web_satis_id IS NULL
  AND (s.kaynak IS NULL OR s.kaynak = 'web')
ON CONFLICT DO NOTHING;

-- Sonuc mesaji
SELECT 'Satislar ve satis kalemleri icin sync triggerlari olusturuldu.' as result;
