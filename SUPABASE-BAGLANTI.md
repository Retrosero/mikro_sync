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

### Yöntem 1: Project Settings (Önerilen)

1. **Supabase Dashboard'a gidin:** https://supabase.com/dashboard
2. **Projenizi seçin**
3. Sol menüden **Project Settings** (⚙️ ikonu) tıklayın
4. **Database** sekmesine tıklayın
5. Aşağı kaydırın, **Connection parameters** bölümünü bulun

**Burada göreceksiniz:**
```
Host: db.xxxxxxxxxxxxx.supabase.co
Database name: postgres
Port: 5432
User: postgres.xxxxxxxxxxxxx
```

**Şifre için:**
- Aynı sayfada "Database password" bölümünde
- "Reset database password" butonuna tıklayın
- Yeni şifre oluşturun ve kaydedin

### Yöntem 2: Connect Butonu

1. **Supabase Dashboard'da projenizi seçin**
2. Sol menüden **Database** tıklayın
3. Sağ üstte **Connect** butonuna tıklayın
4. Açılan pencerede **Connection string** sekmesini seçin
5. **URI** formatını göreceksiniz:

```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**veya**

**Direct connection** sekmesini seçin:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

### Yöntem 3: SQL Editor'den

1. Sol menüden **SQL Editor** tıklayın
2. Yeni bir query açın
3. Şu komutu çalıştırın:

```sql
SELECT 
  current_database() as database,
  current_user as user,
  inet_server_addr() as host,
  inet_server_port() as port;
```

Bu size mevcut bağlantı bilgilerini verecektir.

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

## 🎯 Adım Adım Görsel Rehber

### 1️⃣ Dashboard'a Giriş
```
https://supabase.com/dashboard
↓
Projenizi seçin (örn: "gurbuzsatis")
```

### 2️⃣ Bağlantı Bilgilerini Bulma

**YOL 1: Project Settings (ÖNERİLEN)**
```
Sol menü → ⚙️ Project Settings
↓
Database sekmesi
↓
Aşağı kaydır
↓
"Connection parameters" bölümü
↓
Host: db.xxxxx.supabase.co ← KOPYALA
Port: 5432
Database: postgres
User: postgres
```

**YOL 2: Connect Butonu**
```
Sol menü → Database
↓
Sağ üst → Connect butonu
↓
"Connection string" sekmesi
↓
URI'yi kopyala ve parçala:
postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
           ↑        ↑           ↑                        ↑      ↑
         user   password      host                    port  database
```

### 3️⃣ Şifre Sıfırlama
```
Project Settings → Database
↓
"Database password" bölümü
↓
"Reset database password" butonu
↓
Yeni şifre oluştur
↓
KOPYALA ve .env dosyasına yapıştır
```

### 4️⃣ .env Dosyasını Doldur
```
PG_HOST=db.xxxxxxxxxxxxx.supabase.co     ← Project Settings'den
PG_PORT=5432                              ← Sabit
PG_DATABASE=postgres                      ← Sabit
PG_USER=postgres                          ← Sabit
PG_PASSWORD=YeniOlusturdugunuzSifre       ← Reset password'den
PG_SSL=true                               ← Sabit (Supabase için zorunlu)
```

## 🔍 Bağlantı Bilgilerini Bulma Adımları (Güncel Arayüz)

### Adım 1: Dashboard'a Giriş
```
https://supabase.com/dashboard
```

### Adım 2: Projenizi Seçin
- Ana sayfada projenizi bulun ve tıklayın

### Adım 3: Bağlantı Bilgilerini Bulun

**Seçenek A: Project Settings (En Kolay)**
1. Sol menüden **⚙️ Project Settings** tıklayın
2. **Database** sekmesine tıklayın
3. Aşağı kaydırın
4. **Connection parameters** bölümünde bilgileri göreceksiniz

**Seçenek B: Connect Butonu**
1. Sol menüden **Database** tıklayın
2. Sağ üstte **Connect** butonuna tıklayın
3. **Connection string** veya **Direct connection** sekmesini seçin

**Seçenek C: SQL Editor**
1. Sol menüden **SQL Editor** tıklayın
2. Şu komutu çalıştırın:
```sql
SELECT 
  current_setting('listen_addresses') as host,
  current_database() as database,
  current_user as user;
```

### Adım 4: Şifreyi Alın/Sıfırlayın

**Şifre Sıfırlama:**
1. **Project Settings** → **Database**
2. "Database password" bölümünde
3. **Reset database password** butonuna tıklayın
4. Yeni şifreyi kopyalayın ve güvenli bir yere kaydedin
5. `.env` dosyanıza yapıştırın

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

## ❓ Sık Sorulan Sorular

### Anon/Public Key veya Service Role Key ile bağlanamaz mıyız?

**Hayır.** Bu key'ler Supabase REST API için kullanılır. Bizim projemiz **doğrudan PostgreSQL veritabanına** bağlanır.

**Neden?**
- ✅ Trigger'lar çalışmalı (REST API'de çalışmaz)
- ✅ Transaction güvenliği gerekli
- ✅ Yüksek performans önemli
- ✅ Batch işlemler yapıyoruz

**Detaylı açıklama için:** [SUPABASE-BAGLANTI-YONTEMLERI.md](SUPABASE-BAGLANTI-YONTEMLERI.md)

### Database şifremi unuttum, nasıl sıfırlarım?

1. Supabase Dashboard → Settings → Database
2. "Database Password" bölümünde "Reset Database Password"
3. Yeni şifreyi `.env` dosyanıza girin

### Connection pooling kullanmalı mıyım?

**Hayır, gerek yok.** Projemiz zaten connection pooling kullanıyor (max: 10 connection).

Supabase'in pooler'ını (port 6543) sadece çok yüksek trafikte kullanın.

## 🔗 Faydalı Linkler

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Database Settings:** https://supabase.com/dashboard/project/_/settings/database
- **Connection Pooling:** https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- **SSL Configuration:** https://supabase.com/docs/guides/database/connecting-to-postgres#ssl-enforcement
- **Bağlantı Yöntemleri:** [SUPABASE-BAGLANTI-YONTEMLERI.md](SUPABASE-BAGLANTI-YONTEMLERI.md)
