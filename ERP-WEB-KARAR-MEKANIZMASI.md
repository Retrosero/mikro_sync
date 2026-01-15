# 🧠 ERP -> Web Veri Aktarım ve Karar Mekanizması

Bu doküman, senkronizasyon sisteminin Mikro ERP (MS SQL) verilerini Web (PostgreSQL) veritabanına aktarırken izlediği mantığı, kontrol noktalarını ve karar verme senaryolarını açıklar.

---

## 🚀 1. Temel Senaryo: "Upsert" (Güncelle veya Ekle)

Uygulama, veri kaybını önlemek ve performansı artırmak için **Upsert** (`INSERT ... ON CONFLICT DO UPDATE`) stratejisini kullanır.

### Karar Verme Akışı:
1. **Benzersiz Anahtar Kontrolü:** Her tablo için bir "Benzersiz Anahtar" (Unique Key) belirlenmiştir.
   - Stoklar için: `stok_kodu`
   - Cariler için: `cari_kodu`
   - Barkodlar için: `bar_kodu`
2. **Varlık Kontrolü:** Veri PostgreSQL'e gönderildiğinde, veritabanı seviyesinde bu anahtarın olup olmadığına bakılır.
3. **Karar:**
   - **Anahtar Yoksa:** Yeni kayıt oluşturulur (`INSERT`).
   - **Anahtar Varsa:** Mevcut kaydın içeriği ERP'den gelen yeni bilgilerle güncellenir (`UPDATE`).

---

## 📊 2. Tablo Bazlı Özel Karar Senaryoları

### 📦 Stok Senkronizasyonu
ERP'de `STOKLAR` tablosundaki binlerce ürün taranırken şu kontroller yapılır:
- **Aktiflik Kontrolü:** Sadece `sto_pasif_fl = 0` (aktif) olan ürünler çekilir. Pasif ürünler Web tarafına yansıtılmaz.
- **Kategori Eşleştirme:** Ürünün `sto_anagrup_kod` ve `sto_altgrup_kod` alanlarına bakılır. 
  - Uygulama önce Web'deki `kategoriler` tablosunda bu kodları arar.
  - Eğer kategori bulunamazsa, ürün "Kategorisiz" veya hiyerarşideki en üst gruba atanır.
- **Miktar Senaryosu:** `STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW` tablosuna bakılır. Burada anlık reel stok hesaplanır ve Web'deki `eldeki_miktar` alanı buna göre **ezilerek** güncellenir.

### 👥 Cari (Müşteri/Tedarikçi) Senkronizasyonu
- **Tip Kontrolü:** Kayıtların Mikro'daki `cari_tipi` alanına bakılır.
- **Eşleşme:** Web tarafında kayıt oluştuktan sonra PostgreSQL'deki benzersiz `uuid` değeri alınır ve Mikro'daki karşılığı ile birlikte `int_kodmap_cari` tablosuna yazılır. Bir sonraki aktarımda sistem önce bu "mapping" tablosuna bakarak hangi kaydı güncelleyeceğine karar verir.

### 🏷️ Barkod Senkronizasyonu
- **Çoklu Barkod Kararı:** Bir ürünün birden fazla barkodu olabilir.
- **Süreç:** Mikro'daki `BARKOD_TANIMLARI` taranırken `bar_iptal = 0` olanlar alınır. Aynı ürün kodu için birden fazla barkod varsa, hepsi Web'deki `urun_barkodlari` tablosuna ayrı satırlar olarak işlenir.

---

## ⚡ 3. Aktarım Yöntemine Göre Karar Farklılıkları

### A. Sıralı Kuyruk (Queue) Takibi (`index.js`)
Sistem Mikro tarafındaki `SYNC_QUEUE` tablosunu izlerken şu mantıkla çalışır:
- **Status Kontrolü:** Sadece `status = 'pending'` olanları alır.
- **Öncelik (Priority):** Aynı anda 100 kayıt varsa, `priority` (öncelik) değeri en düşük olanı (örneğin 1 numaralı kritik bir cari güncelleme) önce yapar.
- **Hata Limiti:** Eğer bir kayıt 3 kez hata verirse (`retry_count >= 3`), sistem o kaydı pas geçer ve `failed` statüsüne çeker. Bu, tüm senkronizasyonun tek bir hatalı kayıt yüzünden durmasını engeller.

### B. Toplu Aktarım (Bulk Sync - `fast_bulk_sync.js`)
Yüksek hız modunda karar verme:
- **Batch Processing:** Veriler 5000'erli paketler (batch) halinde paketlenir.
- **Transaction:** Bir paket içindeki 5000 kayıttan biri bile veritabanı seviyesinde kritik bir hata (Constraint violation) verirse, o paketin tamamı geri çekilir (Rollback) ve hata loglanır.

---

## 🔗 4. Eşleştirme (Mapping) Mekanizması

Uygulamanın en kritik karar noktası **`LookupTables`** servisidir. Bir veri aktarılmadan önce şu kontrol hiyerarşisi uygulanır:

1. **Bellek (Cache):** Veri ID'si uygulamanın RAM'inde var mı? (En hızlı)
2. **Mapping Tablosu:** Eğer RAM'de yoksa PostgreSQL'deki `int_kodmap_...` tablolarına bak.
3. **Doğrudan Sorgu:** Eğer mapping'de de yoksa ana tabloya (`stoklar` veya `cari_hesaplar`) git ve kod üzerinden arama yap.
4. **Yeni Kayıt:** Hiçbir yerde yoksa, bu "Yeni bir veridir" kararı verilir.

---

## 💡 Yönetim İçin Altın Kurallar ve Öneriler

1. **Mikro Temizliği:** ERP tarafında stok kodu veya barkodu boş olan kayıtlar sistemin "karar vermesini" zorlaştırır ve hata loglarını doldurur. ERP tarafında veri kalitesini yüksek tutun.
2. **Manuel Tetikleme:** Eğer Web'de bir veri ERP ile uyuşmuyorsa, Mikro tarafındaki ilgili kartta (Stok/Cari) küçük bir değişiklik yapıp kaydetmek, trigger'ı tetikleyerek verinin "Kuyruk Senaryosu" ile 60 saniye içinde güncellenmesini sağlar.
3. **Log İzleme:** Uygulamanın karar veremediği durumlar `logs/error.log` dosyasına `Mapping bulunamadı` uyarısıyla düşer. Bu dosyayı haftalık kontrol etmek sistem sağlığı için kritiktir.

---

*Doküman Tarihi: 2026-01-15*
