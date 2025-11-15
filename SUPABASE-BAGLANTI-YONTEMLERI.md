# Supabase Bağlantı Yöntemleri

## 🔌 İki Farklı Bağlantı Yöntemi

### 1. PostgreSQL Direkt Bağlantı (Mevcut Projemiz) ✅

**Kullanılan:** Database şifresi
**Bağlantı:** Doğrudan PostgreSQL veritabanına
**Port:** 5432 (veya 6543 pooler için)

```env
PG_HOST=db.xxxxxxxxxxxxx.supabase.co
PG_PORT=5432
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=YourDatabasePassword
PG_SSL=true
```

**Avantajları:**
- ✅ Tam PostgreSQL özellikleri
- ✅ Trigger'lar çalışır
- ✅ Transaction desteği
- ✅ Stored procedure'ler
- ✅ Daha hızlı (direkt bağlantı)

**Kullanım Alanı:**
- Backend uygulamalar
- Senkronizasyon sistemleri (bizim projemiz)
- ETL işlemleri
- Batch işlemler

---

### 2. Supabase REST API (Anon/Service Role Key) ❌

**Kullanılan:** API Key (anon_key veya service_role_key)
**Bağlantı:** Supabase REST API üzerinden
**Port:** 443 (HTTPS)

```env
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Avantajları:**
- ✅ Row Level Security (RLS) desteği
- ✅ Realtime subscriptions
- ✅ Storage API
- ✅ Auth API
- ✅ Edge Functions

**Dezavantajları:**
- ❌ Trigger'lar çalışmaz (API üzerinden)
- ❌ Transaction sınırlı
- ❌ Stored procedure çağrılamaz
- ❌ Daha yavaş (HTTP overhead)

**Kullanım Alanı:**
- Frontend uygulamalar (React, Vue, Angular)
- Mobile uygulamalar
- Serverless functions
- Public API'ler

---

## 🤔 Neden Direkt PostgreSQL Bağlantısı Kullanıyoruz?

### Projemizin İhtiyaçları:

1. **Trigger Sistemi** ⚠️
   - Web'de veri değişince trigger tetiklenir
   - ERP'de veri değişince trigger tetiklenir
   - REST API ile trigger'lar çalışmaz!

2. **Transaction Güvenliği** ⚠️
   - Satış başlık + satırlar atomik olmalı
   - Rollback desteği gerekli
   - REST API'de sınırlı transaction

3. **Performans** ⚠️
   - Batch işlemler (50-100 kayıt)
   - Direkt bağlantı daha hızlı
   - HTTP overhead yok

4. **Queue Sistemi** ⚠️
   - sync_queue tablosuna direkt erişim
   - Karmaşık sorgular
   - JOIN işlemleri

---

## 📊 Karşılaştırma

| Özellik | PostgreSQL Direkt | REST API (Key) |
|---------|-------------------|----------------|
| **Trigger'lar** | ✅ Çalışır | ❌ Çalışmaz |
| **Transaction** | ✅ Tam destek | ⚠️ Sınırlı |
| **Performans** | ✅ Hızlı | ⚠️ Yavaş |
| **Batch İşlem** | ✅ Kolay | ❌ Zor |
| **RLS** | ❌ Manuel | ✅ Otomatik |
| **Realtime** | ⚠️ LISTEN/NOTIFY | ✅ Subscriptions |
| **Auth** | ❌ Yok | ✅ Var |
| **Storage** | ❌ Yok | ✅ Var |

---

## 🔐 Supabase Key'leri Nerede Bulunur?

Eğer REST API kullanmak isterseniz:

### Dashboard → Settings → API

**1. Project URL:**
```
https://xxxxxxxxxxxxx.supabase.co
```

**2. anon (public) key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
```
- Frontend'de kullanılır
- RLS kurallarına tabidir
- Public erişim

**3. service_role (secret) key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
```
- Backend'de kullanılır
- RLS kurallarını bypass eder
- Admin erişim
- ⚠️ GİZLİ TUTULMALI!

---

## 🚫 Neden REST API Kullanamayız?

### Senaryo: Satış Ekleme

**PostgreSQL Direkt (Mevcut):**
```javascript
// 1. Satış ekle
INSERT INTO satislar (...)

// 2. Trigger otomatik tetiklenir
// 3. sync_queue'ya kayıt eklenir
// 4. Sync service işler
// 5. ERP'ye yazar
```

**REST API ile (Çalışmaz):**
```javascript
// 1. Satış ekle (API üzerinden)
POST https://xxx.supabase.co/rest/v1/satislar

// 2. Trigger ÇALIŞMAZ! ❌
// 3. sync_queue'ya kayıt EKLENMEz! ❌
// 4. Senkronizasyon OLMAZ! ❌
```

**Neden?**
- REST API, trigger'ları tetiklemez
- Trigger'lar sadece direkt PostgreSQL bağlantısında çalışır
- Bu bizim senkronizasyon sistemimizin temelidir

---

## 💡 Alternatif: Hybrid Yaklaşım

Eğer hem REST API hem de direkt bağlantı kullanmak isterseniz:

### Senaryo 1: Frontend + Backend

**Frontend (Web App):**
```javascript
// Supabase JS Client kullan
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xxx.supabase.co',
  'anon_key'
)

// RLS ile güvenli erişim
await supabase.from('satislar').insert({...})
```

**Backend (Sync Service):**
```javascript
// PostgreSQL direkt bağlantı
const { Pool } = require('pg')

const pool = new Pool({
  host: 'db.xxx.supabase.co',
  password: 'database_password'
})

// Trigger'lar çalışır
await pool.query('INSERT INTO satislar ...')
```

### Senaryo 2: Edge Functions

Supabase Edge Functions ile trigger benzeri davranış:

```typescript
// supabase/functions/on-satis-insert/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { record } = await req.json()
  
  // Senkronizasyon işlemini tetikle
  await syncToERP(record)
  
  return new Response('OK')
})
```

**Ancak:**
- ❌ Daha karmaşık
- ❌ Webhook kurulumu gerekli
- ❌ Latency artar
- ❌ Hata yönetimi zor

---

## ✅ Önerilen Yaklaşım (Mevcut)

**Projemiz için en iyi yöntem:**

```env
# Direkt PostgreSQL bağlantısı
PG_HOST=db.xxxxxxxxxxxxx.supabase.co
PG_PORT=5432
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=YourDatabasePassword
PG_SSL=true
```

**Neden?**
1. ✅ Trigger'lar çalışır
2. ✅ Transaction güvenliği
3. ✅ Yüksek performans
4. ✅ Basit mimari
5. ✅ Kolay hata yönetimi

---

## 🔒 Güvenlik Notları

### Database Password vs API Keys

**Database Password:**
- ⚠️ Sadece backend'de kullanın
- ⚠️ .env dosyasında saklayın
- ⚠️ Git'e commit etmeyin
- ⚠️ Production'da environment variable kullanın

**API Keys:**
- ⚠️ anon_key: Frontend'de kullanılabilir (RLS ile korumalı)
- ⚠️ service_role_key: ASLA frontend'de kullanmayın!
- ⚠️ .env dosyasında saklayın

---

## 📚 Supabase Dokümantasyonu

- **Database Access:** https://supabase.com/docs/guides/database/connecting-to-postgres
- **API Keys:** https://supabase.com/docs/guides/api/api-keys
- **REST API:** https://supabase.com/docs/guides/api
- **Triggers:** https://supabase.com/docs/guides/database/postgres/triggers

---

## 🎯 Sonuç

**Bizim projemiz için:**
- ✅ **PostgreSQL direkt bağlantı** kullanıyoruz
- ✅ **Database password** ile bağlanıyoruz
- ❌ **API keys** kullanmıyoruz (gerek yok)

**Neden?**
- Trigger sistemi çalışmalı
- Transaction güvenliği gerekli
- Yüksek performans önemli
- Backend-to-backend senkronizasyon

**Eğer ileride:**
- Frontend web app eklerseniz → REST API + anon_key
- Mobile app eklerseniz → REST API + anon_key
- Public API sunarsanız → REST API + RLS

**Ama senkronizasyon servisi için:**
- Her zaman direkt PostgreSQL bağlantısı ✅
