-- satislar tablosuna durum kolonu ekle
ALTER TABLE satislar 
ADD COLUMN IF NOT EXISTS durum VARCHAR(50) DEFAULT 'tamamlandi';

-- satis_kalemleri tablosuna kdv_orani kolonu ekle
ALTER TABLE satis_kalemleri 
ADD COLUMN IF NOT EXISTS kdv_orani NUMERIC(5,2) DEFAULT 20;

-- Kontrol
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'satislar' AND column_name = 'durum';

SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'satis_kalemleri' AND column_name = 'kdv_orani';
