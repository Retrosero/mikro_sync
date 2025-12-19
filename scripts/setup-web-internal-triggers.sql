
-- Alış -> Cari Hesap Hareketleri
CREATE OR REPLACE FUNCTION sync_alis_to_cari_hareket_updated()
RETURNS TRIGGER AS $$
DECLARE
    v_hareket_tipi VARCHAR(50);
    v_hareket_turu VARCHAR(50);
    v_tutar NUMERIC;
    v_onceki_bakiye NUMERIC;
    v_sonraki_bakiye NUMERIC;
BEGIN
    -- Hareket Tipi ve Tutar Yönü
    IF NEW.fatura_tipi = 'iade' OR NEW.iade = true THEN
         v_hareket_tipi := 'alis_iade';
         v_tutar := NEW.toplam_tutar; -- Cari borçlanır, bakiye artar (+)
    ELSE
         v_hareket_tipi := 'alis';
         v_tutar := -NEW.toplam_tutar; -- Cari alacaklanır, bakiye düşer (-)
    END IF;

    -- Hareket Türü (Ödeme Şekline Göre)
    -- Nakit ve Havale durumunu basitçe map ediyoruz
    IF NEW.odeme_sekli = 'nakit' THEN
        v_hareket_turu := 'Kasadan K.';
    ELSIF NEW.odeme_sekli = 'havale' OR NEW.odeme_sekli = 'eft' THEN
        v_hareket_turu := 'Bankadan K.';
    ELSE
        v_hareket_turu := 'Açık Hesap';
    END IF;

    -- Mevcut Bakiye
    SELECT bakiye INTO v_onceki_bakiye FROM cari_hesaplar WHERE id = NEW.tedarikci_id;
    IF v_onceki_bakiye IS NULL THEN v_onceki_bakiye := 0; END IF;

    v_sonraki_bakiye := v_onceki_bakiye + v_tutar;

    -- Cari Bakiye Güncelle
    UPDATE cari_hesaplar SET bakiye = v_sonraki_bakiye WHERE id = NEW.tedarikci_id;

    -- Cari Hareketi Ekle
    INSERT INTO cari_hesap_hareketleri (
        cari_hesap_id, islem_tarihi, hareket_tipi, tutar, 
        onceki_bakiye, sonraki_bakiye, belge_no, aciklama,
        hareket_turu, referans_id, belge_tipi, created_at, updated_at
    ) VALUES (
        NEW.tedarikci_id,
        NEW.fatura_tarihi,
        v_hareket_tipi,
        ABS(v_tutar), -- Pozitif tutar
        v_onceki_bakiye,
        v_sonraki_bakiye,
        NEW.belge_no,
        NEW.aciklama,
        v_hareket_turu,
        NEW.id,
        'fatura',
        NOW(),
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alis_to_cari_hareket ON alislar;
CREATE TRIGGER trg_alis_to_cari_hareket
AFTER INSERT ON alislar
FOR EACH ROW EXECUTE FUNCTION sync_alis_to_cari_hareket_updated();

-- Alış Kalem -> Stok Hareketleri
CREATE OR REPLACE FUNCTION sync_alis_kalem_to_stok_hareket_updated()
RETURNS TRIGGER AS $$
DECLARE
    v_hareket_tipi VARCHAR(50);
    v_stok_miktar INTEGER;
    v_fatura_tipi VARCHAR(50);
    v_iade BOOLEAN;
    v_belge_no VARCHAR(50);
    v_tedarikci_id UUID;
    v_fatura_tarihi DATE;
BEGIN
    -- Alış Başlık Bilgilerini Al
    SELECT fatura_tipi, iade, belge_no, tedarikci_id, fatura_tarihi 
    INTO v_fatura_tipi, v_iade, v_belge_no, v_tedarikci_id, v_fatura_tarihi
    FROM alislar WHERE id = NEW.alis_id;
    
    IF v_fatura_tipi = 'iade' OR v_iade = true THEN
         v_hareket_tipi := 'cikis';
         v_stok_miktar := -NEW.miktar;
    ELSE
         v_hareket_tipi := 'giris';
         v_stok_miktar := NEW.miktar;
    END IF;

    -- Stok Miktarını Güncelle (eldeki_miktar)
    UPDATE stoklar SET eldeki_miktar = COALESCE(eldeki_miktar, 0) + v_stok_miktar WHERE id = NEW.stok_id;

    -- Stok Hareketi Ekle
    INSERT INTO stok_hareketleri (
        stok_id, hareket_tipi, miktar, belge_no, islem_tarihi,
        cari_hesap_id, referans_id, 
        birim_fiyat, toplam_tutar
    ) VALUES (
        NEW.stok_id,
        v_hareket_tipi,
        NEW.miktar,
        v_belge_no,
        COALESCE(v_fatura_tarihi, NOW()),
        v_tedarikci_id,
        NEW.alis_id,
        NEW.birim_fiyat,
        NEW.toplam_tutar
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alis_kalem_to_stok_hareket ON alis_kalemleri;
CREATE TRIGGER trg_alis_kalem_to_stok_hareket
AFTER INSERT ON alis_kalemleri
FOR EACH ROW EXECUTE FUNCTION sync_alis_kalem_to_stok_hareket_updated();
