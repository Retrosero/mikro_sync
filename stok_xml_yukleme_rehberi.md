# Sadece Stoklar XML Oluşturma ve Sunucuya Yükleme Rehberi

Bu rehber, mevcut projedeki "Sadece Stoklar" XML dosyasını oluşturan ve FTP sunucusuna yükleyen fonksiyonun başka bir projeye nasıl dahil edileceğini açıklar.

## 1. Gerekli Kütüphaneler

Aşağıdaki kütüphanelerin Python ortamınızda kurulu olması gerekir:

```bash
pip install pyodbc
```

`xml.etree.ElementTree`, `ftplib`, `os` kütüphaneleri Python ile birlikte standart olarak gelir.

## 2. Kullanılacak Kod Bloğu

Aşağıdaki fonksiyonu yeni projenize kopyalayıp, yapılandırma (config) kısımlarını kendi sunucu bilgilerinizle güncelleyerek kullanabilirsiniz.

```python
import pyodbc
import xml.etree.ElementTree as ET
import ftplib
import os
import logging

# Loglama ayarları
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stok_sync")

def create_and_upload_stock_xml():
    # --- YAPILANDIRMA ---
    # MSSQL Bağlantı Bilgileri
    mssql_conn_str = (
        "Driver={ODBC Driver 17 for SQL Server};"
        "Server=GURBUZ;" # MSSQL Sunucu Adı
        "Database=MikroDB_V15_02;" # Veritabanı Adı
        "Trusted_Connection=yes;" # Windows Authentication kullanılıyorsa
    )
    
    # FTP Sunucu Bilgileri
    FTP_HOST = "sunucu_ip_veya_adresi"
    FTP_USER = "ftp_kullanıcı_adı"
    FTP_PASSWORD = "ftp_şifre"
    FTP_PATH = "/public_html/xml_folder" # XML'in yükleneceği uzak dizin
    
    local_xml_file = "sadece-stoklar.xml"
    # --------------------

    try:
        # 1. MSSQL Veritabanına Bağlan
        conn = pyodbc.connect(mssql_conn_str)
        cursor = conn.cursor()

        # 2. Ürün ve Stok Bilgilerini Getiren SQL Sorgusu
        query = """
        SELECT
            S.sto_kod AS Product_code,
            S.sto_isim AS Name,
            S.sto_marka_kodu AS Brand,
            S.sto_kisa_ismi AS alt_baslik,
            S.sto_yer_kod AS raf_numarasi,
            S.sto_sektor_kodu AS alt_baslik2,
            S.sto_ambalaj_kodu AS mensei,
            S.sto_altgrup_kod AS grup_kod,
            S.sto_anagrup_kod AS ana_grup_kod,
            B.bar_kodu AS barcode,
            SHM.sth_eldeki_miktar AS stock,
            SF1.sfiyat_fiyati AS Price,
            SF2.sfiyat_fiyati AS Price2,
            SF3.sfiyat_fiyati AS Pricebayi
        FROM
            STOKLAR S
        LEFT JOIN
            BARKOD_TANIMLARI B ON S.sto_kod = B.bar_stokkodu
        LEFT JOIN
            STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW SHM ON S.sto_kod = SHM.sth_stok_kod
        LEFT JOIN
            STOK_SATIS_FIYAT_LISTELERI SF1 ON S.sto_kod = SF1.sfiyat_stokkod AND SF1.sfiyat_listesirano = 1
        LEFT JOIN
            STOK_SATIS_FIYAT_LISTELERI SF2 ON S.sto_kod = SF2.sfiyat_stokkod AND SF2.sfiyat_listesirano = 2
        LEFT JOIN
            STOK_SATIS_FIYAT_LISTELERI SF3 ON S.sto_kod = SF3.sfiyat_stokkod AND SF3.sfiyat_listesirano = 3
        """

        logger.info("MSSQL'den veriler çekiliyor...")
        cursor.execute(query)
        rows = cursor.fetchall()

        # 3. XML Yapısını Oluştur
        root = ET.Element("Products")

        for row in rows:
            product = ET.SubElement(root, "Product")
            ET.SubElement(product, "Product_code").text = str(row.Product_code or '')
            ET.SubElement(product, "Name").text = str(row.Name or '')
            ET.SubElement(product, "Brand").text = str(row.Brand or '')
            ET.SubElement(product, "alt_baslik").text = str(row.alt_baslik or '')
            ET.SubElement(product, "raf_numarasi").text = str(row.raf_numarasi or '')
            ET.SubElement(product, "alt_baslik2").text = str(row.alt_baslik2 or '')
            ET.SubElement(product, "mensei").text = str(row.mensei or '')
            ET.SubElement(product, "grup_kod").text = str(row.grup_kod or '')
            ET.SubElement(product, "ana_grup_kod").text = str(row.ana_grup_kod or '')
            ET.SubElement(product, "barcode").text = str(row.barcode or '')
            ET.SubElement(product, "stock").text = str(row.stock or 0)
            ET.SubElement(product, "Price").text = str(row.Price or 0)
            ET.SubElement(product, "Price2").text = str(row.Price2 or 0)
            ET.SubElement(product, "Pricebayi").text = str(row.Pricebayi or 0)

        # 4. XML'i Yerel Dosyaya Kaydet
        tree = ET.ElementTree(root)
        tree.write(local_xml_file, encoding="utf-8", xml_declaration=True)
        logger.info(f"Yerel XML dosyası oluşturuldu: {local_xml_file}")

        # 5. FTP Sunucusuna Yükle
        logger.info(f"FTP'ye bağlanılıyor: {FTP_HOST}...")
        ftp = ftplib.FTP(FTP_HOST, timeout=30)
        ftp.login(FTP_USER, FTP_PASSWORD)
        ftp.set_pasv(True)

        # FTP dizinine git (yoksa hata verebilir, manuel kontrol gerekebilir)
        try:
            ftp.cwd(FTP_PATH)
        except:
             logger.warning(f"Dizin bulunamadı veya gidilemedi: {FTP_PATH}")

        with open(local_xml_file, 'rb') as f:
            ftp.storbinary(f'STOR {os.path.basename(local_xml_file)}', f)
        
        ftp.quit()
        logger.info("✅ Stok XML dosyası sunucuya başarıyla yüklendi.")

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        logger.error(f"🚨 İşlem sırasında hata oluştu: {str(e)}")
        return False

if __name__ == "__main__":
    create_and_upload_stock_xml()
```

## 3. Nasıl Entegre Edilir?

1.  **Gereksinimler**: Yeni projenizin çalıştığı sunucuda/bilgisayarda `ODBC Driver 17 for SQL Server` kurulu olmalıdır.
2.  **Bağlantı Dizesi (`conn_str`)**: `Server` (sunucu adı) ve `Database` kısmını kendi veritabanınıza göre güncelleyin. Eğer kullanıcı adı ve şifre ile bağlanıyorsanız:
    ```python
    mssql_conn_str = "Driver={ODBC Driver 17 for SQL Server};Server=SUNUCU_ADRESI;Database=DB_ADI;UID=kullanici;PWD=sifre;"
    ```
3.  **FTP Bilgileri**: `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` ve `FTP_PATH` alanlarını sunucu bilgilerinizle doldurun.
4.  **Otomasyon**: Bu fonksiyonu bir Windows Görev Zamanlayıcı (Task Scheduler) veya bir Python döngüsü içine alarak düzenli aralıklarla çalışmasını sağlayabilirsiniz.

## 4. Önemli Notlar
*   **SQL Sorgusu**: Sorgu içinde kullanılan `STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW` bir view'dır. Yeni veritabanında bu view'ın aynı isimle mevcut olduğundan emin olun.
*   **Hata Ayıklama**: İşlem sırasında oluşan hataları terminalden veya log dosyasından takip edebilirsiniz.
