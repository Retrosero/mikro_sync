-- Tüm eski trigger fonksiyonlarını temizle

-- Trigger'ları sil
DROP TRIGGER IF EXISTS trg_stoklar_sync ON stoklar CASCADE;
DROP TRIGGER IF EXISTS trg_cari_hesaplar_sync ON cari_hesaplar CASCADE;
DROP TRIGGER IF EXISTS trg_iadeler_sync ON iadeler CASCADE;
DROP TRIGGER IF EXISTS trg_alislar_sync ON alislar CASCADE;

-- Fonksiyonları sil
DROP FUNCTION IF EXISTS trigger_stoklar_sync() CASCADE;
DROP FUNCTION IF EXISTS trigger_cari_hesaplar_sync() CASCADE;
DROP FUNCTION IF EXISTS trigger_iadeler_sync() CASCADE;
DROP FUNCTION IF EXISTS trigger_alislar_sync() CASCADE;

SELECT 'Eski ERP->Web trigger''lar temizlendi!' as message;
