-- =====================================================
-- Örnek Mapping Verileri
-- PostgreSQL'de çalıştırılacak
-- =====================================================

-- NOT: UUID ve kod değerlerini kendi verilerinize göre değiştirin!

-- Cari Mapping Örnekleri
INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod) VALUES
  ('00000000-0000-0000-0000-000000000001', '120.01.001'),
  ('00000000-0000-0000-0000-000000000002', '120.01.002'),
  ('00000000-0000-0000-0000-000000000003', '120.01.003')
ON CONFLICT (web_cari_id) DO NOTHING;

-- Stok Mapping Örnekleri
INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod) VALUES
  ('00000000-0000-0000-0000-000000000001', 'URN001'),
  ('00000000-0000-0000-0000-000000000002', 'URN002'),
  ('00000000-0000-0000-0000-000000000003', 'URN003')
ON CONFLICT (web_stok_id) DO NOTHING;

-- Banka Mapping Örnekleri
INSERT INTO int_kodmap_banka (web_banka_id, erp_banka_kod) VALUES
  ('00000000-0000-0000-0000-000000000001', 'BNK001'),
  ('00000000-0000-0000-0000-000000000002', 'BNK002')
ON CONFLICT (web_banka_id) DO NOTHING;

-- Kasa Mapping Örnekleri
INSERT INTO int_kodmap_kasa (web_kasa_id, erp_kasa_kod) VALUES
  ('00000000-0000-0000-0000-000000000001', 'KSA001'),
  ('00000000-0000-0000-0000-000000000002', 'KSA002')
ON CONFLICT (web_kasa_id) DO NOTHING;

-- Fiyat Liste Mapping Örnekleri
INSERT INTO int_kodmap_fiyat_liste (web_fiyat_tanimi_id, erp_liste_no) VALUES
  ('00000000-0000-0000-0000-000000000001', 1),
  ('00000000-0000-0000-0000-000000000002', 2),
  ('00000000-0000-0000-0000-000000000003', 3)
ON CONFLICT (web_fiyat_tanimi_id) DO NOTHING;

-- =====================================================
-- Gerçek Mapping Verilerini Almak İçin Sorgular
-- =====================================================

-- Web'deki Cari ID'leri
-- SELECT id, cari_kodu, cari_adi FROM cari_hesaplar ORDER BY cari_kodu;

-- ERP'deki Cari Kodları
-- SELECT cari_RECno, cari_kod, cari_unvan1 FROM CARI_HESAPLAR ORDER BY cari_kod;

-- Web'deki Stok ID'leri
-- SELECT id, stok_kodu, stok_adi FROM stoklar ORDER BY stok_kodu;

-- ERP'deki Stok Kodları
-- SELECT sto_RECno, sto_kod, sto_isim FROM STOKLAR ORDER BY sto_kod;

-- =====================================================
-- Mapping Kontrolü
-- =====================================================

-- Eksik cari mapping'leri bul
SELECT DISTINCT s.cari_hesap_id, c.cari_kodu, c.cari_adi
FROM satislar s
JOIN cari_hesaplar c ON c.id = s.cari_hesap_id
WHERE s.cari_hesap_id NOT IN (
  SELECT web_cari_id FROM int_kodmap_cari
)
ORDER BY c.cari_kodu;

-- Eksik stok mapping'leri bul
SELECT DISTINCT sk.stok_id, s.stok_kodu, s.stok_adi
FROM satis_kalemleri sk
JOIN stoklar s ON s.id = sk.stok_id
WHERE sk.stok_id NOT IN (
  SELECT web_stok_id FROM int_kodmap_stok
)
ORDER BY s.stok_kodu;
