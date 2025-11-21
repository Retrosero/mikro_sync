-- Senkronizasyon Durumu Takip Tablosu
-- PostgreSQL (Web) veritabanında oluşturulacak

CREATE TABLE IF NOT EXISTS public.sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tablo_adi VARCHAR(100) NOT NULL,
  yon VARCHAR(20) NOT NULL CHECK (yon IN ('erp_to_web', 'web_to_erp')),
  son_senkronizasyon_zamani TIMESTAMP WITH TIME ZONE,
  kayit_sayisi INTEGER DEFAULT 0,
  basarili BOOLEAN DEFAULT true,
  hata_mesaji TEXT,
  olusturma_tarihi TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  guncelleme_tarihi TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tablo_adi, yon)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_sync_state_tablo ON public.sync_state(tablo_adi);
CREATE INDEX IF NOT EXISTS idx_sync_state_yon ON public.sync_state(yon);
CREATE INDEX IF NOT EXISTS idx_sync_state_zaman ON public.sync_state(son_senkronizasyon_zamani);

COMMENT ON TABLE public.sync_state IS 'Her tablo için son senkronizasyon zamanını ve durumunu tutar';
COMMENT ON COLUMN public.sync_state.tablo_adi IS 'Senkronize edilen tablo adı (örn: STOKLAR, satislar)';
COMMENT ON COLUMN public.sync_state.yon IS 'Senkronizasyon yönü: erp_to_web veya web_to_erp';
COMMENT ON COLUMN public.sync_state.son_senkronizasyon_zamani IS 'Son başarılı senkronizasyon zamanı';
COMMENT ON COLUMN public.sync_state.kayit_sayisi IS 'Son senkronizasyonda işlenen kayıt sayısı';

SELECT 'sync_state tablosu başarıyla oluşturuldu!' AS mesaj;
