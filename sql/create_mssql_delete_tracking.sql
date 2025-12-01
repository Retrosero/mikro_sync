-- Silinen kayıtları takip etmek için log tablosu
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MIKRO_SYNC_DELETED_LOG]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MIKRO_SYNC_DELETED_LOG](
        [id] [int] IDENTITY(1,1) NOT NULL,
        [table_name] [nvarchar](50) NOT NULL,
        [record_id] [nvarchar](100) NOT NULL,
        [deleted_at] [datetime] DEFAULT GETDATE(),
        [processed] [bit] DEFAULT 0,
        PRIMARY KEY CLUSTERED ([id] ASC)
    )
END
GO

-- STOKLAR tablosu için silme trigger'ı
IF OBJECT_ID(N'[dbo].[TRG_MIKRO_SYNC_STOK_DELETE]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[TRG_MIKRO_SYNC_STOK_DELETE]
GO

CREATE TRIGGER [dbo].[TRG_MIKRO_SYNC_STOK_DELETE]
ON [dbo].[STOKLAR]
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[MIKRO_SYNC_DELETED_LOG] (table_name, record_id)
    SELECT 'STOKLAR', sto_kod FROM deleted
END
GO

-- CARI_HESAPLAR tablosu için silme trigger'ı
IF OBJECT_ID(N'[dbo].[TRG_MIKRO_SYNC_CARI_DELETE]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[TRG_MIKRO_SYNC_CARI_DELETE]
GO

CREATE TRIGGER [dbo].[TRG_MIKRO_SYNC_CARI_DELETE]
ON [dbo].[CARI_HESAPLAR]
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[MIKRO_SYNC_DELETED_LOG] (table_name, record_id)
    SELECT 'CARI_HESAPLAR', cari_kod FROM deleted
END
GO

-- BARKOD_TANIMLARI tablosu için silme trigger'ı
IF OBJECT_ID(N'[dbo].[TRG_MIKRO_SYNC_BARKOD_DELETE]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[TRG_MIKRO_SYNC_BARKOD_DELETE]
GO

CREATE TRIGGER [dbo].[TRG_MIKRO_SYNC_BARKOD_DELETE]
ON [dbo].[BARKOD_TANIMLARI]
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO [dbo].[MIKRO_SYNC_DELETED_LOG] (table_name, record_id)
    SELECT 'BARKOD_TANIMLARI', bar_kodu FROM deleted
    WHERE bar_kodu IS NOT NULL AND bar_kodu != ''
END
GO

-- STOK_SATIS_FIYAT_LISTELERI tablosu için silme trigger'ı
-- Not: Fiyat listelerinde PK genellikle stok kodu + liste sırasıdır.
-- Burada basitlik için stok kodu ve liste sırasını birleştirip kaydedebiliriz veya JSON olarak.
-- Ancak şimdilik sadece stok kodunu kaydedelim, o stoğun tüm fiyatlarını güncelleriz.
IF OBJECT_ID(N'[dbo].[TRG_MIKRO_SYNC_FIYAT_DELETE]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[TRG_MIKRO_SYNC_FIYAT_DELETE]
GO

CREATE TRIGGER [dbo].[TRG_MIKRO_SYNC_FIYAT_DELETE]
ON [dbo].[STOK_SATIS_FIYAT_LISTELERI]
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    -- Fiyat silindiğinde, o stoğun fiyatlarını tekrar kontrol etmek gerekebilir.
    -- Ancak burada spesifik bir fiyat kaydı siliniyor.
    -- Web tarafında fiyatlar 'urun_fiyat_listeleri' tablosunda.
    -- record_id olarak "STOK_KODU|LISTE_SIRA" formatını kullanalım.
    INSERT INTO [dbo].[MIKRO_SYNC_DELETED_LOG] (table_name, record_id)
    SELECT 'STOK_SATIS_FIYAT_LISTELERI', sfiyat_stokkod + '|' + CAST(sfiyat_listesirano AS NVARCHAR(10)) FROM deleted
END
GO
