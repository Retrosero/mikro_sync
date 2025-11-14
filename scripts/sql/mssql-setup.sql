-- =====================================================
-- MS SQL Senkronizasyon Tabloları ve Trigger'lar
-- =====================================================

-- Sync Queue Tablosu
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SYNC_QUEUE')
BEGIN
  CREATE TABLE SYNC_QUEUE (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    source_table NVARCHAR(100) NOT NULL,
    operation NVARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id NVARCHAR(100) NOT NULL,
    record_data NVARCHAR(MAX),
    priority INT DEFAULT 5,
    status NVARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    retry_count INT DEFAULT 0,
    error_message NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    processed_at DATETIME
  );
  
  CREATE INDEX idx_sync_queue_status ON SYNC_QUEUE(status, priority, created_at);
  CREATE INDEX idx_sync_queue_table ON SYNC_QUEUE(source_table);
END
GO

-- Mapping Tabloları
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'INT_KodMap_Cari')
BEGIN
  CREATE TABLE INT_KodMap_Cari (
    web_cari_id UNIQUEIDENTIFIER PRIMARY KEY,
    erp_cari_kod VARCHAR(25) UNIQUE NOT NULL,
    sync_date DATETIME DEFAULT GETDATE(),
    created_at DATETIME DEFAULT GETDATE()
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'INT_KodMap_Stok')
BEGIN
  CREATE TABLE INT_KodMap_Stok (
    web_stok_id UNIQUEIDENTIFIER PRIMARY KEY,
    erp_stok_kod VARCHAR(25) UNIQUE NOT NULL,
    sync_date DATETIME DEFAULT GETDATE(),
    created_at DATETIME DEFAULT GETDATE()
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'INT_KodMap_Banka')
BEGIN
  CREATE TABLE INT_KodMap_Banka (
    web_banka_id UNIQUEIDENTIFIER PRIMARY KEY,
    erp_banka_kod VARCHAR(25) UNIQUE NOT NULL,
    sync_date DATETIME DEFAULT GETDATE(),
    created_at DATETIME DEFAULT GETDATE()
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'INT_KodMap_Kasa')
BEGIN
  CREATE TABLE INT_KodMap_Kasa (
    web_kasa_id UNIQUEIDENTIFIER PRIMARY KEY,
    erp_kasa_kod VARCHAR(25) UNIQUE NOT NULL,
    sync_date DATETIME DEFAULT GETDATE(),
    created_at DATETIME DEFAULT GETDATE()
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'INT_KodMap_FiyatListe')
BEGIN
  CREATE TABLE INT_KodMap_FiyatListe (
    web_fiyat_tanimi_id UNIQUEIDENTIFIER PRIMARY KEY,
    erp_liste_no INT UNIQUE NOT NULL,
    sync_date DATETIME DEFAULT GETDATE(),
    created_at DATETIME DEFAULT GETDATE()
  );
END
GO

-- KDV Pointer Map
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'INT_KdvPointerMap')
BEGIN
  CREATE TABLE INT_KdvPointerMap (
    kdv_oran DECIMAL(5,2) PRIMARY KEY,
    vergi_pntr INT NOT NULL
  );
  
  INSERT INTO INT_KdvPointerMap (kdv_oran, vergi_pntr) VALUES (0, 0);
  INSERT INTO INT_KdvPointerMap (kdv_oran, vergi_pntr) VALUES (1, 1);
  INSERT INTO INT_KdvPointerMap (kdv_oran, vergi_pntr) VALUES (10, 2);
  INSERT INTO INT_KdvPointerMap (kdv_oran, vergi_pntr) VALUES (20, 3);
END
GO

-- Sync Log Tablosu
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SYNC_LOGS')
BEGIN
  CREATE TABLE SYNC_LOGS (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    direction NVARCHAR(20) NOT NULL, -- WEB_TO_ERP, ERP_TO_WEB
    entity NVARCHAR(100) NOT NULL,
    operation NVARCHAR(20) NOT NULL,
    record_id NVARCHAR(100),
    status NVARCHAR(20) NOT NULL,
    error_message NVARCHAR(MAX),
    duration_ms INT,
    created_at DATETIME DEFAULT GETDATE()
  );
  
  CREATE INDEX idx_sync_logs_date ON SYNC_LOGS(created_at);
END
GO

-- =====================================================
-- Trigger: STOKLAR
-- =====================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_STOKLAR_sync')
  DROP TRIGGER trg_STOKLAR_sync;
GO

CREATE TRIGGER trg_STOKLAR_sync
ON STOKLAR
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  
  -- SESSION_CONTEXT kontrolü (döngüyü önle)
  IF SESSION_CONTEXT(N'SYNC_ORIGIN') = 'WEB'
    RETURN;
  
  INSERT INTO SYNC_QUEUE (source_table, operation, record_id, record_data, priority)
  SELECT 
    'STOKLAR',
    CASE WHEN EXISTS(SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
    CAST(i.sto_RECno AS NVARCHAR(100)),
    (SELECT * FROM inserted i2 WHERE i2.sto_RECno = i.sto_RECno FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    2
  FROM inserted i;
END
GO

-- =====================================================
-- Trigger: BARKOD_TANIMLARI
-- =====================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_BARKOD_TANIMLARI_sync')
  DROP TRIGGER trg_BARKOD_TANIMLARI_sync;
GO

CREATE TRIGGER trg_BARKOD_TANIMLARI_sync
ON BARKOD_TANIMLARI
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  
  IF SESSION_CONTEXT(N'SYNC_ORIGIN') = 'WEB'
    RETURN;
  
  INSERT INTO SYNC_QUEUE (source_table, operation, record_id, record_data, priority)
  SELECT 
    'BARKOD_TANIMLARI',
    CASE WHEN EXISTS(SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
    CAST(i.bar_RECno AS NVARCHAR(100)),
    (SELECT * FROM inserted i2 WHERE i2.bar_RECno = i.bar_RECno FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    3
  FROM inserted i;
END
GO

-- =====================================================
-- Trigger: STOK_SATIS_FIYAT_LISTELERI
-- =====================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_STOK_SATIS_FIYAT_LISTELERI_sync')
  DROP TRIGGER trg_STOK_SATIS_FIYAT_LISTELERI_sync;
GO

CREATE TRIGGER trg_STOK_SATIS_FIYAT_LISTELERI_sync
ON STOK_SATIS_FIYAT_LISTELERI
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  
  IF SESSION_CONTEXT(N'SYNC_ORIGIN') = 'WEB'
    RETURN;
  
  INSERT INTO SYNC_QUEUE (source_table, operation, record_id, record_data, priority)
  SELECT 
    'STOK_SATIS_FIYAT_LISTELERI',
    CASE WHEN EXISTS(SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
    CAST(i.sfiyat_RECno AS NVARCHAR(100)),
    (SELECT * FROM inserted i2 WHERE i2.sfiyat_RECno = i.sfiyat_RECno FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    3
  FROM inserted i;
END
GO

-- =====================================================
-- Trigger: CARI_HESAPLAR
-- =====================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_CARI_HESAPLAR_sync')
  DROP TRIGGER trg_CARI_HESAPLAR_sync;
GO

CREATE TRIGGER trg_CARI_HESAPLAR_sync
ON CARI_HESAPLAR
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  
  IF SESSION_CONTEXT(N'SYNC_ORIGIN') = 'WEB'
    RETURN;
  
  INSERT INTO SYNC_QUEUE (source_table, operation, record_id, record_data, priority)
  SELECT 
    'CARI_HESAPLAR',
    CASE WHEN EXISTS(SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
    CAST(i.cari_RECno AS NVARCHAR(100)),
    (SELECT * FROM inserted i2 WHERE i2.cari_RECno = i.cari_RECno FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    2
  FROM inserted i;
END
GO

-- Temizlik prosedürü
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_cleanup_old_sync_records')
  DROP PROCEDURE sp_cleanup_old_sync_records;
GO

CREATE PROCEDURE sp_cleanup_old_sync_records
AS
BEGIN
  DELETE FROM SYNC_QUEUE 
  WHERE status = 'completed' 
  AND processed_at < DATEADD(DAY, -7, GETDATE());
  
  DELETE FROM SYNC_LOGS 
  WHERE created_at < DATEADD(DAY, -30, GETDATE());
END
GO
