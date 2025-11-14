# Changelog

## [1.0.0] - 2025-11-14

### ✨ Özellikler
- Trigger bazlı gerçek zamanlı senkronizasyon
- Çift yönlü veri akışı (Web ↔ ERP)
- Gelişmiş log sistemi
- Otomatik retry mekanizması
- Mapping cache sistemi
- Transaction güvenliği
- Queue yönetimi

### 🔄 Senkronizasyon Kapsamı

#### Web → ERP
- Satışlar (başlık + satırlar)
- Tahsilatlar (nakit, kart, havale, çek, senet)
- Alışlar
- Giderler
- Cari hesap güncellemeleri

#### ERP → Web
- Stok kartları
- Fiyat listeleri
- Barkod tanımları
- Cari hesap hareketleri

### 📊 Log Sistemi
- Detaylı hata raporlama
- Performans metrikleri
- Mapping hata tespiti
- Queue durum takibi
- Log analiz aracı

### 🛠️ Araçlar
- `npm run test-connection` - Bağlantı testi
- `npm run setup-db` - Veritabanı kurulumu
- `npm run analyze-logs` - Log analizi

### 📚 Dokümantasyon
- Hızlı başlangıç kılavuzu
- Detaylı kurulum dökümanı
- Proje yapısı açıklaması
- Sorun giderme rehberi
