# Supabase Bağlantı Kılavuzu

## 📋 Gerekli Bilgiler

Supabase Dashboard'dan (https://supabase.com/dashboard) aşağıdaki bilgileri alın:

### 1. Project Settings → Database

**Bağlantı Bilgileri:**
- **Host**: `db.xxxxxxxxxxxxx.supabase.co`
- **Database name**: `postgres`
- **Port**: `5432` (veya `6543` - Supavisor için)
- **User**: `postgres`
- **Password**: Proje oluştururken belirlediğiniz şifre

### 2. Connection String

Supabase iki tip connection string sunar:

#### A. Session Mode (Önerilen - Uzun Süreli Bağlantılar)
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

#### B. Transaction Mode (Connection Pooling)
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

## 🔧 .env Konfigürasyonu

### Yöntem 1: Ayrı Parametreler (Önerilen)

`.env` dosyanızı şu şekilde düzenleyin:

```env
# MS SQL (ERP) - Değişmez
MSSQL_SERVER=192.168.1.100
MSSQL_PORT=1433
MSSQL_DATABASE=MIKRO_DB
MSSQL_USER=sa
MSSQL_PASSWORD=YourPassword

# PostgreSQL (Supabase)
PG_HOST=db.xxxxxxxxxxxxx.supabase.co
PG_PORT=5432
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=YourSupabasePassword
PG_SSL=true

# Sync Configuration
SYNC_INTERVAL_MS=2000
BATCH_SIZE=50
MAX_RETRY_COUNT=3
LOG_LEVEL=info
```

### Yöntem 2: Connection String

Alternatif olarak connection string kullanabilirsiniz:

```env
# PostgreSQL Connection String
DATABASE_URL=postgresql://postgres:YourPassword@db.xxxxxxxxxxxxx.supabase.co:5432/postgres?sslmode=require
```

## 📍 Supabase Bilgilerini Nereden Bulacaksınız?

### Adım 1: Supabase Dashboard'a Giriş
1. https://supabase.com/dashboard adresine gidin
2. Projenizi seçin

### Adım 2: Database Settings
1. Sol menüden **Settings** → **Database** seçin
2. **Connection string** bölümünde bilgileri bulacaksınız

### Adım 3: Bilgileri Kopyalayın

**Connection Info** sekmesinde:
```
Host: db.xxxxxxxxxxxxx.supabase.co
Database name: postgres
Port: 5432
User: postgres
Password: [Proje oluştururken belirlediğiniz]
```

**Connection string** sekmesinde:
```
URI: postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

## 🔐 SSL Bağlantısı

Supabase **SSL bağlantısı gerektirir**. `.env` dosyanızda:

```env
PG_SSL=true
```

## 🧪 Bağlantıyı Test Etme

### 1. .env Dosyasını Düzenleyin

```env
PG_HOST=db.xxxxxxxxxxxxx.supabase.co
PG_PORT=5432
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=YourSupabasePassword
PG_SSL=true
```

### 2. Test Komutunu Çalıştırın

```bash
npm run test-connection
```

**Başarılı Çıktı:**
```
======================================================================
  Veritabanı Bağlantı Testi
======================================================================

[PostgreSQL] Bağlantı test ediliyor...
✓ PostgreSQL bağlantısı başarılı
  Zaman: 2025-11-14 10:30:00
  Versiyon: PostgreSQL 15.x
```

## 🚨 Sık Karşılaşılan Sorunlar

### Sorun 1: SSL Hatası

**Hata:**
```
Error: self signed certificate in certificate chain
```

**Çözüm:**
```env
PG_SSL=true
```

Veya config dosyasında:
```javascript
ssl: {
  rejectUnauthorized: false
}
```

### Sorun 2: Connection Timeout

**Hata:**
```
Error: Connection timeout
```

**Çözüm:**
1. IP adresinizin Supabase'de izin listesinde olduğundan emin olun
2. Firewall ayarlarını kontrol edin
3. Port 5432'nin açık olduğundan emin olun

### Sorun 3: Authentication Failed

**Hata:**
```
Error: password authentication failed
```

**Çözüm:**
1. Şifrenizi Supabase Dashboard'dan sıfırlayın
2. Özel karakterler varsa URL encode edin
3. `.env` dosyasında tırnak işareti kullanmayın

## 🔄 Connection Pooling (Opsiyonel)

Yüksek trafikli uygulamalar için Supavisor (connection pooler) kullanın:

```env
# Transaction Mode - Connection Pooling
PG_HOST=aws-0-eu-central-1.pooler.supabase.com
PG_PORT=6543
PG_DATABASE=postgres
PG_USER=postgres.xxxxxxxxxxxxx
PG_PASSWORD=YourPassword
PG_SSL=true
```

**Not:** Transaction mode'da bazı PostgreSQL özellikleri (prepared statements, LISTEN/NOTIFY) çalışmayabilir.

## 📊 Supabase Özel Ayarlar

### Max Connections

Supabase Free Plan:
- Direct connections: 60
- Pooler connections: 200

Bağlantı sayısını `.env` dosyasında ayarlayın:

```env
# Connection Pool Settings
PG_MAX_CONNECTIONS=10
PG_IDLE_TIMEOUT=30000
PG_CONNECTION_TIMEOUT=10000
```

## 🛠️ Gelişmiş Konfigürasyon

`config/postgresql.config.js` dosyasını güncelleyin:

```javascript
require('dotenv').config();

module.exports = {
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: process.env.PG_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  max: parseInt(process.env.PG_MAX_CONNECTIONS || '10'),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '10000'),
  // Supabase için özel ayarlar
  statement_timeout: 30000, // 30 saniye
  query_timeout: 30000,
  application_name: 'mikro_sync'
};
```

## 📝 Örnek .env Dosyası (Supabase)

```env
# MS SQL (ERP)
MSSQL_SERVER=192.168.1.100
MSSQL_PORT=1433
MSSQL_DATABASE=MIKRO_DB
MSSQL_USER=sa
MSSQL_PASSWORD=YourErpPassword
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

# PostgreSQL (Supabase)
PG_HOST=db.abcdefghijklmnop.supabase.co
PG_PORT=5432
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=YourSupabasePassword123!
PG_SSL=true
PG_MAX_CONNECTIONS=10
PG_IDLE_TIMEOUT=30000
PG_CONNECTION_TIMEOUT=10000

# Sync Configuration
SYNC_INTERVAL_MS=2000
BATCH_SIZE=50
MAX_RETRY_COUNT=3
LOG_LEVEL=info
```

## 🔍 Bağlantı Bilgilerini Bulma Adımları

### 1. Supabase Dashboard
```
https://supabase.com/dashboard/project/[PROJECT-ID]
```

### 2. Settings → Database
```
Settings (sol menü) → Database → Connection string
```

### 3. Bilgileri Kopyala
- **URI** sekmesinden connection string'i kopyalayın
- Veya **Connection Info** sekmesinden ayrı ayrı bilgileri alın

### 4. Şifreyi Değiştirme (Gerekirse)
```
Settings → Database → Database Password → Reset Database Password
```

## ✅ Kontrol Listesi

- [ ] Supabase projesini oluşturdunuz
- [ ] Database şifresini aldınız/sıfırladınız
- [ ] Connection string'i kopyaladınız
- [ ] `.env` dosyasını oluşturdunuz
- [ ] SSL'i etkinleştirdiniz (`PG_SSL=true`)
- [ ] `npm run test-connection` çalıştırdınız
- [ ] Bağlantı başarılı oldu

## 🚀 Kurulum Sonrası

Bağlantı başarılı olduktan sonra:

```bash
# 1. Veritabanı tablolarını oluştur
npm run setup-db

# 2. Mapping verilerini ekle
# scripts/sample-mappings.sql dosyasını Supabase SQL Editor'de çalıştır

# 3. Uygulamayı başlat
npm start
```

## 📞 Yardım

Sorun yaşarsanız:

1. **Bağlantı Testi:**
   ```bash
   npm run test-connection
   ```

2. **Supabase Logs:**
   - Dashboard → Logs → Postgres Logs

3. **Uygulama Logs:**
   ```bash
   tail -f logs/error.log
   ```

4. **Supabase Support:**
   - https://supabase.com/docs
   - https://github.com/supabase/supabase/discussions

## 🔗 Faydalı Linkler

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Database Settings:** https://supabase.com/dashboard/project/_/settings/database
- **Connection Pooling:** https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- **SSL Configuration:** https://supabase.com/docs/guides/database/connecting-to-postgres#ssl-enforcement
