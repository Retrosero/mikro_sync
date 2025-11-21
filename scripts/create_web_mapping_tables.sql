-- Web-ERP Senkronizasyon için Mapping Tabloları
-- PostgreSQL (Supabase) üzerinde çalıştırılmalıdır

-- 1. INT_KodMap_Cari: Web Cari ID <-> ERP Cari Kod Eşleşmesi
CREATE TABLE IF NOT EXISTS public.int_kodmap_cari (
    web_cari_id UUID NOT NULL,
    erp_cari_kod VARCHAR(50) NOT NULL,
    aciklama TEXT,
    sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (web_cari_id),
    UNIQUE (erp_cari_kod)
);

COMMENT ON TABLE public.int_kodmap_cari IS 'Web cari_hesaplar.id ile ERP CARI_HESAPLAR.cari_kod eşleşmesi';

-- 2. INT_KodMap_Stok: Web Stok ID <-> ERP Stok Kod Eşleşmesi
CREATE TABLE IF NOT EXISTS public.int_kodmap_stok (
    web_stok_id UUID NOT NULL,
    erp_stok_kod VARCHAR(50) NOT NULL,
    aciklama TEXT,
    sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (web_stok_id),
    UNIQUE (erp_stok_kod)
);

COMMENT ON TABLE public.int_kodmap_stok IS 'Web stoklar.id ile ERP STOKLAR.sto_kod eşleşmesi';

-- 3. INT_KodMap_Banka: Web Banka ID <-> ERP Banka Kod Eşleşmesi
CREATE TABLE IF NOT EXISTS public.int_kodmap_banka (
    web_banka_id UUID NOT NULL,
    erp_banka_kod VARCHAR(50) NOT NULL,
    aciklama TEXT,
    sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (web_banka_id),
    UNIQUE (erp_banka_kod)
);

COMMENT ON TABLE public.int_kodmap_banka IS 'Web bankalar.id ile ERP banka kodu eşleşmesi';

-- 4. INT_KodMap_Kasa: Web Kasa ID <-> ERP Kasa Kod Eşleşmesi
CREATE TABLE IF NOT EXISTS public.int_kodmap_kasa (
    web_kasa_id UUID NOT NULL,
    erp_kasa_kod VARCHAR(50) NOT NULL,
    aciklama TEXT,
    sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (web_kasa_id),
    UNIQUE (erp_kasa_kod)
);

COMMENT ON TABLE public.int_kodmap_kasa IS 'Web kasalar.id ile ERP kasa kodu eşleşmesi';

-- 5. INT_KodMap_FiyatListe: Web Fiyat Tanımı ID <-> ERP Fiyat Liste No Eşleşmesi
CREATE TABLE IF NOT EXISTS public.int_kodmap_fiyat_liste (
    web_fiyat_tanimi_id UUID NOT NULL,
    erp_liste_no INT NOT NULL,
    aciklama TEXT,
    sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (web_fiyat_tanimi_id),
    UNIQUE (erp_liste_no)
);

COMMENT ON TABLE public.int_kodmap_fiyat_liste IS 'Web fiyat_tanimlari.id ile ERP STOK_SATIS_FIYAT_LISTE_TANIMLARI.sfl_sirano eşleşmesi';

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_int_kodmap_cari_erp ON public.int_kodmap_cari(erp_cari_kod);
CREATE INDEX IF NOT EXISTS idx_int_kodmap_stok_erp ON public.int_kodmap_stok(erp_stok_kod);
CREATE INDEX IF NOT EXISTS idx_int_kodmap_banka_erp ON public.int_kodmap_banka(erp_banka_kod);
CREATE INDEX IF NOT EXISTS idx_int_kodmap_kasa_erp ON public.int_kodmap_kasa(erp_kasa_kod);
CREATE INDEX IF NOT EXISTS idx_int_kodmap_fiyat_erp ON public.int_kodmap_fiyat_liste(erp_liste_no);

-- Örnek veri ekleme (İhtiyaca göre düzenleyin)
-- ÖRNEK: INSERT INTO public.int_kodmap_cari (web_cari_id, erp_cari_kod, aciklama) 
--        VALUES ('uuid-buraya', 'CARI001', 'Örnek Cari');

SELECT 'Mapping tabloları başarıyla oluşturuldu!' AS mesaj;
