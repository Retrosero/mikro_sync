# SATIŞ SENKRONIZASYON VERİ AKIŞI RAPORU

## 📊 VERİ KAYNAKLARI (WEB → ERP)

### WEB Tarafı (PostgreSQL)

#### 1. `satislar` Tablosu (Satış Başlığı)
**Kaynak Alanlar:**
- `id` → Satış ID
- `notlar` → **Satış genel notları** (şu an boş)
- `iskonto1-6` → Satış seviyesi iskontolar
- `cari_hesap_id` → Müşteri
- `satis_tarihi` → Tarih
- `toplam_tutar` → Toplam
- `fatura_seri_no`, `fatura_sira_no` → Evrak bilgileri

#### 2. `satis_kalemleri` Tablosu (Satış Kalemleri)
**Kaynak Alanlar:**
- `satis_id` → Bağlı olduğu satış
- `stok_id` → Ürün
- `miktar` → Adet
- `birim_fiyat` → Fiyat
- `toplam_tutar` → Toplam
- **`notlar`** → **Kalem bazlı notlar** ✅ VAR
- **`iskonto1-6`** → **Kalem bazlı iskontolar** ✅ VAR (örn: iskonto1=35.00)
- `kdv_tutari`, `kdv_orani` → KDV bilgileri

---

### ERP Tarafı (MS SQL)

#### 1. `CARI_HESAP_HAREKETLERI` (Satış Başlığı)
**Hedef Alanlar:**
- `cha_kod` → Cari/Kasa/Banka kodu
- `cha_meblag` → Toplam tutar
- `cha_aciklama` → Açıklama (satislar.notlar)
- `cha_ft_iskonto1-6` → Başlık iskontolar
- `cha_evrakno_seri`, `cha_evrakno_sira` → Evrak no

#### 2. `STOK_HAREKETLERI` (Satış Kalemleri)
**Hedef Alanlar:**
- `sth_stok_kod` → Ürün kodu
- `sth_miktar` → Miktar
- `sth_tutar` → Tutar
- **`sth_aciklama`** → **Açıklama** (satislar.notlar VEYA satis_kalemleri.notlar)
- **`sth_iskonto1-6`** → **İskontolar** (satis_kalemleri.iskonto1-6)
- `sth_vergi`, `sth_vergi_pntr` → KDV

---

## 🔄 TRANSFORM MANTIK

### Dosya: `transformers/satis.transformer.js`

#### `transformSatisKalem()` Fonksiyonu
```javascript
// Satır 404: NOTLAR
sth_aciklama: (webSatis.notlar || '').substring(0, 255)
// ❌ SORUN: webSatis.notlar kullanıyor (satislar tablosu)
// ✅ ÇÖZÜM: webKalem.notlar kullanmalı (satis_kalemleri tablosu)

// Satır 337-342: İSKONTOLAR
sth_iskonto1: webKalem.iskonto1 || 0
sth_iskonto2: webKalem.iskonto2 || 0
// ✅ DOĞRU: webKalem kullanıyor
```

---

## ❌ TESPİT EDİLEN SORUNLAR

### 1. NOTLAR SORUNU
**Mevcut Kod:**
```javascript
sth_aciklama: (webSatis.notlar || '').substring(0, 255)
```

**Sorun:** 
- `webSatis.notlar` → `satislar` tablosundan geliyor (boş)
- `webKalem.notlar` → `satis_kalemleri` tablosundan geliyor ("NOT" - DOLU)

**Çözüm:**
```javascript
sth_aciklama: (webKalem.notlar || webSatis.notlar || '').substring(0, 255)
```

### 2. İSKONTO SORUNU (Potansiyel)
**Mevcut Kod:** Doğru görünüyor ama test sonucu 0 geliyor.

**Olası Nedenler:**
1. `webKalem` nesnesi doğru gelmiyor
2. Değerler `null` veya `undefined` olarak geliyor
3. Numeric → String dönüşümü sorunu

---

## 🔧 YAPILMASI GEREKENLER

### 1. Notlar Düzeltmesi
- [x] `sth_aciklama` alanını `webKalem.notlar` kullanacak şekilde güncelle
- [ ] Öncelik: Kalem notları, yoksa satış notları

### 2. İskonto Düzeltmesi  
- [x] Field mapping'leri düzelt (indirim_tutari kaldırıldı)
- [ ] Değerlerin doğru geldiğini doğrula
- [ ] Numeric tip kontrolü ekle

### 3. Test
- [ ] Yeni satış oluştur
- [ ] Kalem notları ve iskonto ekle
- [ ] Sync yap
- [ ] ERP'de kontrol et

---

## 📝 MEVCUT DURUM

**Test Satış:** ST-52
- **Web Kalem Notları:** "NOT" ✅
- **Web Kalem İskonto1:** 35.00 ✅
- **ERP sth_aciklama:** (boş) ❌
- **ERP sth_iskonto1:** 0 ❌

**Sonuç:** Veriler Web'de mevcut ama ERP'ye aktarılmıyor!
