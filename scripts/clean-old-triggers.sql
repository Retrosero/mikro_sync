-- Tüm eski trigger'ları ve fonksiyonları temizle

-- 1. Trigger'ları sil
DROP TRIGGER IF EXISTS satis_sync_trigger ON satislar;
DROP TRIGGER IF EXISTS tahsilat_sync_trigger ON tahsilatlar;

-- 2. Eski fonksiyonları sil
DROP FUNCTION IF EXISTS notify_satis_sync();
DROP FUNCTION IF EXISTS notify_tahsilat_sync();
DROP FUNCTION IF EXISTS trigger_satislar_sync();
DROP FUNCTION IF EXISTS trigger_tahsilatlar_sync();

-- Başarı mesajı
SELECT 'Eski trigger''lar ve fonksiyonlar temizlendi!' as message;
