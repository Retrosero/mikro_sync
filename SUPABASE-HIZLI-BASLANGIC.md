# Supabase Hızlı Başlangıç (Güncel Arayüz)

## 🚀 5 Dakikada Kurulum

### 1️⃣ Supabase Project URL'inizi Bulun

Dashboard'da projenizi seçtiğinizde, tarayıcı adres çubuğunda:
```
https://supabase.com/project/xxxxxxxxxxxxx/...
                              ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                              PROJECT-REF
```

Bu `xxxxxxxxxxxxx` sizin **Project Reference ID**'niz.

### 2️⃣ Host Adresini Oluşturun

```
db.[PROJECT-REF].supabase.co
```

**Örnek:**
- Project REF: `abcdefghijklmnop`
- Host: `db.abcdefghijklmnop.supabase.co`

### 3️⃣ Şifre Oluşturun

**Yöntem A: Dashboard'dan**
1. Sol menü → **⚙️ Project Settings**
2. **Database** sekmesi
3. "Database password" → **Reset database password**
4. Yeni şifreyi kopyalayın

**Yöntem B: İlk Kurulum Şifresi**
- Projeyi ilk oluştururken belirlediğiniz şifre
- Eğer kaydettiyseniz onu kullanın

### 4️⃣ .env Dosyasını Oluşturun

```bash
cp .env.example .env
```

`.env` dosyasını açın ve düzenleyin:

```env
# PostgreSQL (Supabase)
PG_HOST=db.abcdefghijklmnop.supabase.co    # ← Adım 2'den
PG_PORT=5432
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=YourNewPassword123!             # ← Adım 3'ten
PG_SSL=true
```

### 5️⃣ Test Edin

```bash
npm run supabase-setup
```

**Başarılı çıktı:**
```
✅ Bağlantı başarılı!
📊 PostgreSQL Versiyonu: PostgreSQL 15.x
✅ Supabase ortamı tespit edildi
```

---

## 🔍 Alternatif: Connect Butonu ile

Eğer yukarıdaki yöntem çalışmazsa:

### Adım 1: Connect Butonunu Kullanın

1. Dashboard → Sol menü → **Database**
2. Sağ üstte **Connect** butonuna tıklayın
3. Açılan pencerede seçenekleri göreceksiniz

### Adım 2: Connection String'i Kopyalayın

**"Connection string" sekmesi:**

**Session mode (Önerilen):**
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

**Transaction mode (Pooler):**
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### Adım 3: Parçalayın

Connection string'den bilgileri çıkarın:

```
postgresql://postgres:MyPass123@db.abcdefgh.supabase.co:5432/postgres
              ↑        ↑         ↑                       ↑     ↑
            user   password    host                   port database
```

`.env` dosyasına yazın:
```env
PG_HOST=db.abcdefgh.supabase.co
PG_PORT=5432
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=MyPass123
PG_SSL=true
```

---

## 🎯 Hangi Bilgileri Kullanmalıyım?

### Session Mode (Önerilen) ✅
```
Host: db.xxxxxxxxxxxxx.supabase.co
Port: 5432
```
- Direkt bağlantı
- Trigger'lar çalışır
- Transaction tam destek
- **Bizim projemiz için ideal**

### Transaction Mode (Pooler) ⚠️
```
Host: aws-0-[region].pooler.supabase.com
Port: 6543
```
- Connection pooling
- Yüksek trafik için
- Bazı özellikler sınırlı
- **Gerekmedikçe kullanmayın**

---

## 📋 Kontrol Listesi

- [ ] Project REF ID'yi buldum
- [ ] Host adresini oluşturdum (`db.[PROJECT-REF].supabase.co`)
- [ ] Database şifresini sıfırladım/aldım
- [ ] `.env` dosyasını oluşturdum
- [ ] `PG_SSL=true` yazdım
- [ ] `npm run supabase-setup` çalıştırdım
- [ ] Bağlantı başarılı oldu ✅

---

## 🚨 Sorun Giderme

### "Connection string bulamıyorum"

**Çözüm:** Connect butonu yerine Project Settings kullanın:
1. ⚙️ Project Settings → Database
2. "Connection parameters" bölümünde bilgiler var

### "Host adresini bulamıyorum"

**Çözüm:** Project REF'ten oluşturun:
1. Tarayıcı URL'inde project ID'yi bulun
2. `db.[PROJECT-ID].supabase.co` formatında yazın

### "Şifremi unuttum"

**Çözüm:** Sıfırlayın:
1. Project Settings → Database
2. "Reset database password"
3. Yeni şifreyi `.env` dosyasına yazın

### "SSL hatası alıyorum"

**Çözüm:** `.env` dosyasında:
```env
PG_SSL=true
```

### "Connection timeout"

**Çözüm:**
1. İnternet bağlantınızı kontrol edin
2. Firewall ayarlarını kontrol edin
3. Supabase'in çalıştığından emin olun (status.supabase.com)

---

## 💡 İpuçları

### 1. Şifreyi Güvenli Tutun
```bash
# .env dosyasını Git'e eklemeyin
echo ".env" >> .gitignore
```

### 2. Şifreyi Test Edin
```bash
# Bağlantı testi
npm run supabase-setup
```

### 3. Şifreyi Kaydedin
- Şifre yöneticisi kullanın (1Password, LastPass, vb.)
- Veya güvenli bir yere not edin
- **Asla Git'e commit etmeyin!**

---

## 🎓 Örnek Senaryo

**Diyelim ki:**
- Project URL: `https://supabase.com/project/abcd1234efgh5678/...`
- Yeni şifre: `MySecurePass123!`

**Yapmanız gerekenler:**

1. **Host oluştur:**
   ```
   db.abcd1234efgh5678.supabase.co
   ```

2. **.env dosyası:**
   ```env
   PG_HOST=db.abcd1234efgh5678.supabase.co
   PG_PORT=5432
   PG_DATABASE=postgres
   PG_USER=postgres
   PG_PASSWORD=MySecurePass123!
   PG_SSL=true
   ```

3. **Test et:**
   ```bash
   npm run supabase-setup
   ```

4. **Başarılı! 🎉**

---

## 📞 Hala Sorun mu Yaşıyorsunuz?

1. **Detaylı log kontrol edin:**
   ```bash
   npm run supabase-setup
   ```

2. **Supabase Dashboard'da kontrol edin:**
   - Project Settings → Database
   - Connection parameters bölümü

3. **SQL Editor'de test edin:**
   ```sql
   SELECT current_database(), current_user;
   ```

4. **Dokümantasyonu inceleyin:**
   - [SUPABASE-BAGLANTI.md](SUPABASE-BAGLANTI.md)
   - [SUPABASE-BAGLANTI-YONTEMLERI.md](SUPABASE-BAGLANTI-YONTEMLERI.md)

---

## ✅ Başarılı Kurulum Sonrası

```bash
# Veritabanı tablolarını oluştur
npm run setup-db

# Mapping verilerini ekle
# Supabase SQL Editor'de scripts/sample-mappings.sql çalıştır

# Uygulamayı başlat
npm start
```

**Tebrikler! Supabase bağlantınız hazır! 🚀**
