
DROP TRIGGER IF EXISTS trg_iade_to_cari_hareket ON iadeler;
DROP TRIGGER IF EXISTS trg_iade_kalem_to_stok_hareket ON iade_kalemleri;
DROP FUNCTION IF EXISTS sync_iade_to_cari_hareket();
DROP FUNCTION IF EXISTS sync_iade_kalem_to_stok_hareket();

DROP TRIGGER IF EXISTS trg_alis_to_cari_hareket ON alislar;
DROP TRIGGER IF EXISTS trg_alis_kalem_to_stok_hareket ON alis_kalemleri;
DROP FUNCTION IF EXISTS sync_alis_to_cari_hareket_updated();
DROP FUNCTION IF EXISTS sync_alis_kalem_to_stok_hareket_updated();
