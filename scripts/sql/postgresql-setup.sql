-- =====================================================
-- PostgreSQL Senkronizasyon Tabloları ve Trigger'lar
-- =====================================================

-- Sync Queue Tablosu
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  record_id TEXT NOT NULL,
  record_data JSONB,
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  INDEX idx_sync_queue_status (status, priority, created_at),
  INDEX idx_sync_queue_table (source_table)
);

-- Mapping Tabloları
CREATE TABLE IF NOT EXISTS int_kodmap_cari (
  web_cari_id UUID PRIMARY KEY,
  erp_cari_kod VARCHAR(25) UNIQUE NOT NULL,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS int_kodmap_stok (
  web_stok_id UUID PRIMARY KEY,
  erp_stok_kod VARCHAR(25) UNIQUE NOT NULL,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS int_kodmap_banka (
  web_banka_id UUID PRIMARY KEY,
  erp_banka_kod VARCHAR(25) UNIQUE NOT NULL,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS int_kodmap_kasa (
  web_kasa_id UUID PRIMARY KEY,
  erp_kasa_kod VARCHAR(25) UNIQUE NOT NULL,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS int_kodmap_fiyat_liste (
  web_fiyat_tanimi_id UUID PRIMARY KEY,
  erp_liste_no INTEGER UNIQUE NOT NULL,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync Log Tablosu
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL, -- WEB_TO_ERP, ERP_TO_WEB
  entity TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Trigger Function: Satışlar
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_satislar_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_queue (source_table, operation, record_id, record_data, priority)
    VALUES ('satislar', TG_OP, NEW.id::TEXT, row_to_json(NEW)::JSONB, 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_satislar_sync ON satislar;
CREATE TRIGGER trg_satislar_sync
AFTER INSERT OR UPDATE ON satislar
FOR EACH ROW
EXECUTE FUNCTION trigger_satislar_sync();

-- =====================================================
-- Trigger Function: Satış Kalemleri
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_satis_kalemleri_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_queue (source_table, operation, record_id, record_data, priority)
    VALUES ('satis_kalemleri', TG_OP, NEW.id::TEXT, row_to_json(NEW)::JSONB, 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_satis_kalemleri_sync ON satis_kalemleri;
CREATE TRIGGER trg_satis_kalemleri_sync
AFTER INSERT OR UPDATE ON satis_kalemleri
FOR EACH ROW
EXECUTE FUNCTION trigger_satis_kalemleri_sync();

-- =====================================================
-- Trigger Function: Tahsilatlar
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_tahsilatlar_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_queue (source_table, operation, record_id, record_data, priority)
    VALUES ('tahsilatlar', TG_OP, NEW.id::TEXT, row_to_json(NEW)::JSONB, 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tahsilatlar_sync ON tahsilatlar;
CREATE TRIGGER trg_tahsilatlar_sync
AFTER INSERT OR UPDATE ON tahsilatlar
FOR EACH ROW
EXECUTE FUNCTION trigger_tahsilatlar_sync();

-- =====================================================
-- Trigger Function: Alışlar
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_alislar_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_queue (source_table, operation, record_id, record_data, priority)
    VALUES ('alislar', TG_OP, NEW.id::TEXT, row_to_json(NEW)::JSONB, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alislar_sync ON alislar;
CREATE TRIGGER trg_alislar_sync
AFTER INSERT OR UPDATE ON alislar
FOR EACH ROW
EXECUTE FUNCTION trigger_alislar_sync();

-- =====================================================
-- Trigger Function: Alış Kalemleri
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_alis_kalemleri_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_queue (source_table, operation, record_id, record_data, priority)
    VALUES ('alis_kalemleri', TG_OP, NEW.id::TEXT, row_to_json(NEW)::JSONB, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alis_kalemleri_sync ON alis_kalemleri;
CREATE TRIGGER trg_alis_kalemleri_sync
AFTER INSERT OR UPDATE ON alis_kalemleri
FOR EACH ROW
EXECUTE FUNCTION trigger_alis_kalemleri_sync();

-- =====================================================
-- Trigger Function: Giderler
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_giderler_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_queue (source_table, operation, record_id, record_data, priority)
    VALUES ('giderler', TG_OP, NEW.id::TEXT, row_to_json(NEW)::JSONB, 3);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_giderler_sync ON giderler;
CREATE TRIGGER trg_giderler_sync
AFTER INSERT OR UPDATE ON giderler
FOR EACH ROW
EXECUTE FUNCTION trigger_giderler_sync();

-- =====================================================
-- Trigger Function: Cari Hesaplar
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_cari_hesaplar_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_queue (source_table, operation, record_id, record_data, priority)
    VALUES ('cari_hesaplar', TG_OP, NEW.id::TEXT, row_to_json(NEW)::JSONB, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cari_hesaplar_sync ON cari_hesaplar;
CREATE TRIGGER trg_cari_hesaplar_sync
AFTER INSERT OR UPDATE ON cari_hesaplar
FOR EACH ROW
EXECUTE FUNCTION trigger_cari_hesaplar_sync();

-- Temizlik fonksiyonu (eski kayıtları sil)
CREATE OR REPLACE FUNCTION cleanup_old_sync_records()
RETURNS void AS $$
BEGIN
  DELETE FROM sync_queue 
  WHERE status = 'completed' 
  AND processed_at < NOW() - INTERVAL '7 days';
  
  DELETE FROM sync_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
