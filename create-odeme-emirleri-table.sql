-- ODEME_EMIRLERI tablosunu Web tarafında oluştur
CREATE TABLE IF NOT EXISTS public.odeme_emirleri (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- ERP mapping için
    erp_recno INTEGER,
    
    -- Temel bilgiler
    odeme_tipi TEXT NOT NULL, -- 'cek', 'senet', 'havale', 'kredi_karti'
    refno TEXT UNIQUE, -- Benzersiz referans numarası
    
    -- Çek/Senet bilgileri
    no TEXT, -- Çek/Senet numarası
    banka_adi TEXT,
    sube_adi TEXT,
    hesap_no TEXT,
    borclu TEXT, -- Borçlu/Alacaklı adı
    borclu_tel TEXT,
    vdaire_no TEXT, -- Vergi dairesi no
    
    -- Tutar ve tarih bilgileri
    tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
    vade_tarihi DATE,
    duzen_tarihi DATE,
    
    -- Cari bilgileri
    cari_hesap_id UUID REFERENCES cari_hesaplar(id),
    sahip_cari_kodu TEXT,
    sahip_cari_cins SMALLINT,
    sahip_cari_grupno SMALLINT,
    
    -- Nerede (Banka/Kasa) bilgileri
    banka_id UUID REFERENCES bankalar(id),
    kasa_id UUID REFERENCES kasalar(id),
    nerede_cari_kodu TEXT,
    nerede_cari_cins SMALLINT,
    nerede_cari_grupno SMALLINT,
    
    -- Hareket bilgileri
    ilk_hareket_tarihi DATE,
    ilk_evrak_seri TEXT,
    ilk_evrak_sira_no INTEGER,
    ilk_evrak_satir_no INTEGER,
    son_hareket_tarihi DATE,
    
    -- Durum bilgileri
    doviz_tipi SMALLINT DEFAULT 0, -- 0: TL
    doviz_kur NUMERIC(18,6) DEFAULT 1,
    odenen NUMERIC(15,2) DEFAULT 0,
    iptal BOOLEAN DEFAULT false,
    son_pozisyon SMALLINT DEFAULT 0, -- 0: Portföyde, 1: Tahsil edildi, 2: Bankada
    
    -- Diğer bilgiler
    imza SMALLINT DEFAULT 0,
    sorumluluk_merkezi TEXT,
    kesideyeri TEXT,
    
    -- TCMB bilgileri
    tcmb_banka_kodu TEXT,
    tcmb_sube_kodu TEXT,
    tcmb_il_kodu TEXT,
    tasra_fl BOOLEAN DEFAULT false,
    
    -- Proje
    proje_kodu TEXT,
    
    -- Masraflar
    masraf1 NUMERIC(15,2) DEFAULT 0,
    masraf1_isleme SMALLINT DEFAULT 0,
    masraf2 NUMERIC(15,2) DEFAULT 0,
    masraf2_isleme SMALLINT DEFAULT 0,
    
    -- Kredi kartı özel bilgileri
    odul_katkisi_tutari NUMERIC(15,2) DEFAULT 0,
    servis_komisyon_tutari NUMERIC(15,2) DEFAULT 0,
    erken_odeme_faiz_tutari NUMERIC(15,2) DEFAULT 0,
    odul_katkisi_tutari_islendi_fl BOOLEAN DEFAULT false,
    servis_komisyon_tutari_islendi_fl BOOLEAN DEFAULT false,
    erken_odeme_faiz_tutari_islendi_fl BOOLEAN DEFAULT false,
    kredi_karti_tipi SMALLINT,
    taksit_sayisi SMALLINT,
    kacinci_taksit SMALLINT,
    uye_isyeri_no TEXT,
    kredi_karti_no TEXT,
    provizyon_kodu TEXT,
    
    -- Zaman damgaları
    olusturma_tarihi TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    guncelleme_tarihi TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraint
    CONSTRAINT odeme_emirleri_odeme_tipi_check CHECK (odeme_tipi IN ('cek', 'senet', 'havale', 'kredi_karti'))
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_odeme_emirleri_refno ON public.odeme_emirleri(refno);
CREATE INDEX IF NOT EXISTS idx_odeme_emirleri_cari_hesap_id ON public.odeme_emirleri(cari_hesap_id);
CREATE INDEX IF NOT EXISTS idx_odeme_emirleri_banka_id ON public.odeme_emirleri(banka_id);
CREATE INDEX IF NOT EXISTS idx_odeme_emirleri_kasa_id ON public.odeme_emirleri(kasa_id);
CREATE INDEX IF NOT EXISTS idx_odeme_emirleri_erp_recno ON public.odeme_emirleri(erp_recno);
CREATE INDEX IF NOT EXISTS idx_odeme_emirleri_odeme_tipi ON public.odeme_emirleri(odeme_tipi);
CREATE INDEX IF NOT EXISTS idx_odeme_emirleri_vade_tarihi ON public.odeme_emirleri(vade_tarihi);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_odeme_emirleri_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.guncelleme_tarihi = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_odeme_emirleri_updated_at
    BEFORE UPDATE ON public.odeme_emirleri
    FOR EACH ROW
    EXECUTE FUNCTION update_odeme_emirleri_updated_at();

-- Yorum
COMMENT ON TABLE public.odeme_emirleri IS 'Çek, senet, havale ve kredi kartı ödeme emirleri tablosu. ERP ODEME_EMIRLERI tablosu ile senkronize edilir.';
