# 🚀 Web → ERP Senkronizasyon Hızlı Başlangıç

## 3 Adımda Kurulum

### 1️⃣ Trigger'ları Kur
```bash
npm run setup-web-to-erp-triggers
```

### 2️⃣ Worker'ı Başlat (Arka Planda Çalışacak)
```bash
npm run sync-queue-worker
```

### 3️⃣ Test Et
Web uygulamanızda bir satış veya tahsilat oluşturun. Worker otomatik olarak ERP'ye gönderecek!

---

## 📊 Durum Kontrolü

### Queue'yu Kontrol Et
```sql
SELECT * FROM sync_queue ORDER BY created_at DESC LIMIT 10;
```

### İstatistikleri Gör
```sql
SELECT status, COUNT(*) FROM sync_queue GROUP BY status;
```

---

## 🔄 Çift Yönlü Senkronizasyon

Hem ERP → Web hem de Web → ERP:
```bash
npm run sync-bidirectional
```

---

## 📝 Kullanılabilir Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run sync` | Sadece ERP → Web |
| `npm run sync-bidirectional` | Çift yönlü (ERP ↔ Web) |
| `npm run sync-queue-worker` | Web → ERP worker (sürekli çalışır) |
| `npm run setup-web-to-erp-triggers` | Trigger'ları kur |

---

## ⚠️ Önemli Notlar

1. **Worker Sürekli Çalışmalı:** Production'da PM2 veya systemd kullanın
2. **Mapping Tabloları:** `int_kodmap_cari` ve `int_kodmap_stok` dolu olmalı
3. **Kaynak Alanı:** Trigger'lar sadece `kaynak='web'` kayıtları gönderir

---

## 🆘 Sorun mu Yaşıyorsunuz?

Detaylı rehber için: [WEB-TO-ERP-KURULUM.md](./WEB-TO-ERP-KURULUM.md)
