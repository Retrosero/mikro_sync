-- ERP-Web Senkronizasyon için Mapping Tabloları
-- MS SQL Server üzerinde çalıştırılmalıdır

USE MikroDB_V15_02;
GO

-- 1. INT_KdvPointerMap: KDV Oranı -> Vergi Pointer Eşleşmesi
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[INT_KdvPointerMap]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[INT_KdvPointerMap] (
        kdv_oran INT NOT NULL,
        vergi_pntr INT NOT NULL,
        aciklama NVARCHAR(255) NULL,
        sync_date DATETIME DEFAULT GETDATE(),
        PRIMARY KEY (kdv_oran)
    );
    
    -- Varsayılan KDV oranları
    INSERT INTO [dbo].[INT_KdvPointerMap] (kdv_oran, vergi_pntr, aciklama) VALUES
    (0, 0, 'KDV Yok'),
    (1, 1, 'KDV %1'),
    (10, 2, 'KDV %10'),
    (20, 3, 'KDV %20');
    
    PRINT 'INT_KdvPointerMap tablosu oluşturuldu ve varsayılan değerler eklendi.';
END
ELSE
BEGIN
    PRINT 'INT_KdvPointerMap tablosu zaten mevcut.';
END
GO

-- 2. INT_CariHareketMap: Belge Türü -> Cari Hareket Parametreleri
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[INT_CariHareketMap]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[INT_CariHareketMap] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        web_belge_turu NVARCHAR(50) NOT NULL,
        odeme_yeri NVARCHAR(50) NOT NULL,
        iade_mi BIT NOT NULL DEFAULT 0,
        cha_evrak_tip INT NOT NULL,
        cha_tip INT NOT NULL,
        cha_cinsi INT NOT NULL,
        cha_normal_iade INT NOT NULL,
        cha_tpoz INT NOT NULL,
        cha_cari_cins INT NOT NULL,
        aciklama NVARCHAR(255) NULL,
        sync_date DATETIME DEFAULT GETDATE(),
        UNIQUE (web_belge_turu, odeme_yeri, iade_mi)
    );
    
    -- Varsayılan eşleşmeler (Mapping.md'den)
    INSERT INTO [dbo].[INT_CariHareketMap] 
    (web_belge_turu, odeme_yeri, iade_mi, cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_iade, cha_tpoz, cha_cari_cins, aciklama) 
    VALUES
    ('satis_fatura', 'acikhesap', 0, 63, 0, 6, 0, 0, 0, 'Satış Faturası (veresiye)'),
    ('tahsilat', 'kasa', 0, 1, 1, 0, 0, 1, 4, 'Nakitte kasadan kapanış'),
    ('tahsilat', 'banka', 0, 1, 1, 0, 0, 1, 2, 'Kart/Havale bankadan kapanış'),
    ('tahsilat', 'cek', 0, 1, 1, 0, 0, 1, 0, 'Çek tahsilatı'),
    ('tahsilat', 'senet', 0, 1, 1, 0, 0, 1, 0, 'Senet tahsilatı');
    
    PRINT 'INT_CariHareketMap tablosu oluşturuldu ve varsayılan değerler eklendi.';
END
ELSE
BEGIN
    PRINT 'INT_CariHareketMap tablosu zaten mevcut.';
END
GO

-- 3. INT_StokHareketMap: Belge Türü -> Stok Hareket Parametreleri
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[INT_StokHareketMap]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[INT_StokHareketMap] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        web_belge_turu NVARCHAR(50) NOT NULL,
        iade_mi BIT NOT NULL DEFAULT 0,
        sth_tip INT NOT NULL,
        sth_cins INT NOT NULL,
        sth_normal_iade INT NOT NULL,
        sth_evraktip INT NOT NULL,
        aciklama NVARCHAR(255) NULL,
        sync_date DATETIME DEFAULT GETDATE(),
        UNIQUE (web_belge_turu, iade_mi)
    );
    
    -- Varsayılan eşleşmeler
    INSERT INTO [dbo].[INT_StokHareketMap] 
    (web_belge_turu, iade_mi, sth_tip, sth_cins, sth_normal_iade, sth_evraktip, aciklama) 
    VALUES
    ('satis_fatura', 0, 1, 0, 0, 4, 'Satış stok çıkışı'),
    ('alis_fatura', 0, 0, 0, 0, 3, 'Alış stok girişi'),
    ('satis_iade', 1, 1, 0, 1, 4, 'Satış iade stok girişi'),
    ('alis_iade', 1, 0, 0, 1, 3, 'Alış iade stok çıkışı');
    
    PRINT 'INT_StokHareketMap tablosu oluşturuldu ve varsayılan değerler eklendi.';
END
ELSE
BEGIN
    PRINT 'INT_StokHareketMap tablosu zaten mevcut.';
END
GO

-- 4. INT_DepoMap: Belge Türü -> Depo Numarası
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[INT_DepoMap]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[INT_DepoMap] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        web_belge_turu NVARCHAR(50) NOT NULL,
        yon NVARCHAR(10) NOT NULL, -- 'cikis' veya 'giris'
        erp_depo_no INT NOT NULL,
        aciklama NVARCHAR(255) NULL,
        sync_date DATETIME DEFAULT GETDATE(),
        UNIQUE (web_belge_turu, yon)
    );
    
    -- Varsayılan depo (Satış için 1 numaralı depo)
    INSERT INTO [dbo].[INT_DepoMap] 
    (web_belge_turu, yon, erp_depo_no, aciklama) 
    VALUES
    ('satis_fatura', 'cikis', 1, 'Satış çıkış deposu');
    
    PRINT 'INT_DepoMap tablosu oluşturuldu ve varsayılan değerler eklendi.';
END
ELSE
BEGIN
    PRINT 'INT_DepoMap tablosu zaten mevcut.';
END
GO

PRINT '';
PRINT '=================================================================';
PRINT 'Tüm mapping tabloları başarıyla oluşturuldu!';
PRINT '=================================================================';
PRINT '';
PRINT 'NOT: Kod eşleştirme tabloları (INT_KodMap_*) PostgreSQL tarafında';
PRINT 'oluşturulacaktır. Bu tablolar Web ve ERP arasındaki ID eşleşmelerini';
PRINT 'tutacaktır.';
GO
