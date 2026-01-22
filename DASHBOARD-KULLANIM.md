# Mikro Sync Dashboard - Kullanım Kılavuzu

## 🚀 Dashboard'u Başlatma

### Yöntem 1: Terminal ile
1. Terminal (PowerShell veya CMD) açın
2. Proje klasörüne gidin:
   ```
   cd "C:\Users\Gürbüz Oyuncak\Documents\GitHub\mikro_sync"
   ```
3. Dashboard'u başlatın:
   ```
   npm run dashboard
   ```
4. Tarayıcınız otomatik olarak açılacak ve kontrol paneli görünecek!

### Yöntem 2: Masaüstü Kısayolu ile (ÖNERİLEN)
1. `Dashboard-Baslat.bat` dosyasına çift tıklayın
2. Terminal penceresi açılacak ve dashboard başlayacak
3. Tarayıcınız otomatik olarak açılacak

### Yöntem 3: Masaüstü Kısayolu Oluşturma
1. `Dashboard-Baslat.bat` dosyasına sağ tıklayın
2. "Kısayol oluştur" seçeneğini seçin
3. Kısayolu masaüstünüze taşıyın
4. Artık masaüstünden çift tıklayarak başlatabilirsiniz!

## 📋 Kullanım

### Komut Çalıştırma
- İstediğiniz işleme ait butona tıklayın
- İşlem başlayacak ve loglar alt kısımdaki terminal penceresinde görünecek
- Çalışan işlemler turuncu kenarlı olarak gösterilir
- İşlem tamamlandığında başarı/hata mesajı görürsünüz

### Mevcut Komutlar

#### 🔄 Senkronizasyon İşlemleri
- **Sadece ERP → Web Senkronizasyonu**: ERP verilerini Web'e aktarır
- **Çift Yönlü Senkronizasyon**: ERP ↔ Web çift yönlü senkronizasyon
- **Web → ERP Senkronizasyonu**: Web verilerini ERP'ye aktarır
- **Web → ERP (Manuel Script)**: Manuel web to erp sync
- **Entegra Sync**: Entegra entegrasyonu

#### ⚙️ Sürekli Çalışan İşlemler
- **Web → ERP Worker**: Web'den ERP'ye sürekli senkronizasyon (arka planda çalışır)

#### 🔧 Ayarlar ve Yapılandırma
- **Trigger'ları Kur/Güncelle**: Web to ERP trigger'larını günceller
- **Stok XML Oluştur**: Stok XML dosyası oluşturur
- **Fatura Ayarları Sync**: Fatura ayarlarını senkronize eder

### Log Yönetimi
- Loglar otomatik olarak en alta kayar
- "Temizle" butonuna tıklayarak log ekranını temizleyebilirsiniz
- Farklı log tipleri farklı renklerle gösterilir:
  - 🔵 Mavi: Bilgi mesajları
  - 🟢 Yeşil: Başarılı işlemler
  - 🔴 Kırmızı: Hatalar
  - 🟡 Sarı: Uyarılar

## ⚠️ Önemli Notlar

1. **Aynı Anda Çalışan İşlemler**: Aynı işlemi birden fazla kez başlatamazsınız. Çalışan işlemler turuncu kenarlı olarak gösterilir.

2. **Worker İşlemleri**: "Worker" olarak işaretlenmiş işlemler sürekli çalışır. Bunları durdurmak için terminal penceresini kapatmanız gerekir.

3. **Bağlantı Durumu**: Sağ üstteki yeşil nokta, sunucuyla bağlantının aktif olduğunu gösterir.

4. **Port Çakışması**: Eğer 3456 portu kullanılıyorsa, `dashboard/server.js` dosyasındaki `PORT` değişkenini değiştirebilirsiniz.

## 🔧 Sorun Giderme

### Dashboard açılmıyor
- `node_modules` klasörünün var olduğundan emin olun
- Gerekirse `npm install` komutunu çalıştırın

### Tarayıcı otomatik açılmıyor
- Manuel olarak `http://localhost:3456` adresine gidin

### Komutlar çalışmıyor
- Terminal penceresinde hata mesajlarını kontrol edin
- `.env` dosyasının doğru yapılandırıldığından emin olun

## 📞 Destek
Herhangi bir sorun yaşarsanız, terminal çıktılarını ve hata mesajlarını kontrol edin.

---
**© 2026 Mikro Sync Dashboard • Gürbüz Oyuncak**
