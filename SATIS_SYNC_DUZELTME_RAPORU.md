# ✅ SATIŞ SENKRONIZASYON DÜZELTMELERİ - TAMAMLANDI

## 📋 ÖZET

Satışlar Web veritabanından ERP'ye aktarılırken **notlar** ve **iskontolar** aktarılmıyordu. Sorunlar tespit edildi ve düzeltildi.

---

## 🔍 TESPİT EDİLEN SORUNLAR

### 1. NOTLAR SORUNU ❌
**Sorun:** `sth_aciklama` alanı yanlış kaynaktan alınıyordu.
- **Önceki Kod:** `sth_aciklama: (webSatis.notlar || '')` 
- **Kaynak:** `satislar` tablosu (genelde boş)
- **Sonuç:** ERP'de notlar boş geliyordu

**Çözüm:** ✅
- **Yeni Kod:** `sth_aciklama: (webKalem.notlar || webSatis.notlar || '')`
- **Kaynak:** Önce `satis_kalemleri.notlar`, yoksa `satislar.notlar`
- **Dosya:** `transformers/satis.transformer.js` (Satır 404)

### 2. İSKONTO SORUNU ❌
**Sorun:** `groupAsortiKalemler()` fonksiyonu iskonto değerlerini sıfırlıyordu.
- **Önceki Kod:** Yeni grup oluştururken `iskonto1-6: 0` set ediliyor
- **Sonuç:** Tüm iskontolar 0 olarak ERP'ye gidiyordu

**Çözüm:** ✅
- **Değişiklik 1:** İskonto değerlerini toplama mantığı eklendi
- **Değişiklik 2:** Final map'te iskonto alanları eklendi
- **Dosya:** `sync-jobs/satis.processor.js` (Satır 522-575)

### 3. YANLIŞSÜTUN ADLARI ❌
**Sorun:** Olmayan sütun adları kullanılıyordu.
- `indirim_tutari2-6` → Yok
- `indirim_tutari` → Sadece `satislar` tablosunda var, `satis_kalemleri`'nde yok

**Çözüm:** ✅
- Tüm `indirim_tutari` referansları kaldırıldı
- Sadece `iskonto1-6` alanları kullanılıyor

---

## 📊 VERİ AKIŞI

### WEB → ERP Mapping

```
WEB (PostgreSQL)                    ERP (MS SQL)
═══════════════════════════════════════════════════════════

satislar tablosu                    CARI_HESAP_HAREKETLERI
├─ notlar                    →      ├─ cha_aciklama
├─ iskonto1-6                →      ├─ cha_ft_iskonto1-6
├─ toplam_tutar              →      ├─ cha_meblag
└─ fatura_seri_no/sira_no    →      └─ cha_evrakno_seri/sira

satis_kalemleri tablosu             STOK_HAREKETLERI
├─ notlar                    →      ├─ sth_aciklama ✅
├─ iskonto1-6                →      ├─ sth_iskonto1-6 ✅
├─ miktar                    →      ├─ sth_miktar
├─ toplam_tutar              →      ├─ sth_tutar
└─ kdv_tutari                →      └─ sth_vergi
```

---

## 🛠️ YAPILAN DEĞİŞİKLİKLER

### 1. `transformers/satis.transformer.js`

#### Değişiklik 1: Notlar Düzeltmesi (Satır 404)
```javascript
// ÖNCE:
sth_aciklama: (webSatis.notlar || '').substring(0, 255)

// SONRA:
sth_aciklama: (webKalem.notlar || webSatis.notlar || '').substring(0, 255)
```

#### Değişiklik 2: İskonto Field Mapping (Satır 337-342)
```javascript
// ÖNCE:
sth_iskonto1: webKalem.iskonto1 || webKalem.indirim_tutari || 0

// SONRA:
sth_iskonto1: webKalem.iskonto1 || 0
```

#### Değişiklik 3: Başlık İskonto Mapping (Satır 193-198)
```javascript
// ÖNCE:
cha_ft_iskonto1: webSatis.iskonto1 || webSatis.indirim_tutari || 0

// SONRA:
cha_ft_iskonto1: webSatis.iskonto1 || 0
```

### 2. `sync-jobs/satis.processor.js`

#### Değişiklik 1: İskonto Toplama Mantığı (Satır 545-550)
```javascript
// YENİ EKLENEN:
group.iskonto1 = parseFloat(group.iskonto1 || 0) + parseFloat(kalem.iskonto1 || 0);
group.iskonto2 = parseFloat(group.iskonto2 || 0) + parseFloat(kalem.iskonto2 || 0);
group.iskonto3 = parseFloat(group.iskonto3 || 0) + parseFloat(kalem.iskonto3 || 0);
group.iskonto4 = parseFloat(group.iskonto4 || 0) + parseFloat(kalem.iskonto4 || 0);
group.iskonto5 = parseFloat(group.iskonto5 || 0) + parseFloat(kalem.iskonto5 || 0);
group.iskonto6 = parseFloat(group.iskonto6 || 0) + parseFloat(kalem.iskonto6 || 0);
```

#### Değişiklik 2: Final Map İskonto Alanları (Satır 567-575)
```javascript
// ÖNCE:
const results = Object.values(groupedItems).map(item => ({
  ...item,
  miktar: parseFloat(item.miktar.toFixed(4)),
  toplam_tutar: parseFloat(item.toplam_tutar.toFixed(2)),
  kdv_tutari: parseFloat(item.kdv_tutari.toFixed(2)),
  indirim_tutari: parseFloat(item.indirim_tutari.toFixed(2)) // ❌ Yanlış alan
}));

// SONRA:
const results = Object.values(groupedItems).map(item => ({
  ...item,
  miktar: parseFloat(item.miktar.toFixed(4)),
  toplam_tutar: parseFloat(item.toplam_tutar.toFixed(2)),
  kdv_tutari: parseFloat(item.kdv_tutari.toFixed(2)),
  iskonto1: parseFloat((item.iskonto1 || 0).toFixed(2)), // ✅ Doğru
  iskonto2: parseFloat((item.iskonto2 || 0).toFixed(2)),
  iskonto3: parseFloat((item.iskonto3 || 0).toFixed(2)),
  iskonto4: parseFloat((item.iskonto4 || 0).toFixed(2)),
  iskonto5: parseFloat((item.iskonto5 || 0).toFixed(2)),
  iskonto6: parseFloat((item.iskonto6 || 0).toFixed(2))
}));
```

#### Değişiklik 3: Debug Logging (Satır 188-189)
```javascript
// YENİ EKLENEN:
logger.info(`Transform sonucu: iskonto1=${satirData.sth_iskonto1}, aciklama="${satirData.sth_aciklama}"`);
```

---

## ✅ TEST SONUÇLARI

### Test Satış: ST-56
**Web Verileri:**
- Kalem Notları: "NOT"
- Kalem İskonto1: 35.00

**ERP Sonuç:**
```
✅ ST-56 kaydı bulundu:

Satır 1:
  Stok Kod: YS1378-R35
  Miktar: 1
  Tutar: 350
  Açıklama: "NOT"           ← ✅ BAŞARILI
  İskonto1: 35              ← ✅ BAŞARILI
  İskonto2: 0
  İskonto3: 0

════════════════════════════════════════════════════════════
SONUÇ:
════════════════════════════════════════════════════════════
✅ İSKONTO BAŞARILI! İskonto1 = 35
✅ NOTLAR BAŞARILI! Açıklama = "NOT"
════════════════════════════════════════════════════════════
```

---

## 📝 NOTLAR

1. **Öncelik Sırası:** Kalem notları öncelikli, yoksa satış notları kullanılır
2. **Gruplandırma:** Asorti ürünler gruplandırıldığında iskontolar toplanır
3. **Veri Tipi:** İskonto değerleri numeric olarak saklanır ve 2 ondalık basamağa yuvarlanır
4. **Karakter Limiti:** `sth_aciklama` alanı 255 karakter ile sınırlıdır

---

## 🎯 SONUÇ

Tüm sorunlar çözüldü. Artık:
- ✅ Satış notları ERP'ye aktarılıyor
- ✅ Kalem notları ERP'ye aktarılıyor  
- ✅ İskonto değerleri doğru aktarılıyor
- ✅ Asorti gruplandırma iskonto değerlerini koruyor

**Durum:** BAŞARILI ✅
**Tarih:** 2026-02-02
**Test Edilen Evrak:** ST-56
