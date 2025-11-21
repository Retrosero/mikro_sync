# SQL Server Kullanıcı Oluşturma Rehberi

Mikro senkronizasyon servisinin kararlı çalışabilmesi için SQL Server üzerinde özel bir kullanıcı oluşturulması ve "SQL Server Authentication" (Kullanıcı adı/Şifre) ile bağlanılması önerilir.

Aşağıdaki adımları izleyerek kullanıcı oluşturabilirsiniz:

## 1. SQL Server Management Studio (SSMS) ile Bağlanın
1. SSMS'i açın ve mevcut yönteminizle (Windows Authentication) sunucuya bağlanın.

## 2. Yeni Kullanıcı Oluşturma (Login)
1. **Object Explorer** panelinde sunucunuzun altında **Security** > **Logins** klasörüne sağ tıklayın ve **New Login...** seçeneğini seçin.
2. **General** sayfasında:
   - **Login name**: `mikro_sync_user` (veya istediğiniz bir isim)
   - **Authentication**: **SQL Server authentication** seçin.
   - **Password**: Güçlü bir şifre belirleyin (örn: `MikroSync!2025`).
   - **Confirm password**: Şifreyi tekrar girin.
   - **Enforce password policy**: İşaretli kalabilir (şifre kurallarına uymanız gerekir).
   - **Enforce password expiration**: Servis sürekliliği için bu işareti **kaldırmanız** önerilir (şifre süresi dolup servis durmasın diye).

## 3. Veritabanı Yetkilendirmesi
1. Sol menüden **User Mapping** sayfasına geçin.
2. "Users mapped to this login" listesinde **MikroDB_V15_02** (veya ilgili Mikro veritabanınız) kutucuğunu işaretleyin.
3. Alt kısımdaki "Database role membership for: ..." bölümünde:
   - **db_datareader**: Verileri okumak için (Zorunlu).
   - **db_datawriter**: Eğer ERP'ye veri yazılacaksa (Sipariş aktarımı vb.) seçin. Sadece okuma yapılacaksa gerekmez.
   - **public**: Varsayılan olarak seçilidir.

## 4. Kullanıcıyı Oluşturun
- **OK** butonuna tıklayarak kullanıcıyı oluşturun.

## 5. SQL Server Authentication Modunu Kontrol Edin
Eğer daha önce sadece Windows Authentication kullanıyorsanız, SQL Server'ın karma modu (Mixed Mode) desteklediğinden emin olun:
1. Object Explorer'da en üstteki Sunucu ismine sağ tıklayın > **Properties**.
2. **Security** sekmesine gelin.
3. "Server authentication" altında **SQL Server and Windows Authentication mode** seçeneğinin işaretli olduğundan emin olun.
4. Eğer değiştirdiyseniz, SQL Server servisini yeniden başlatmanız gerekir (Services.msc üzerinden veya SSMS'de sunucuya sağ tık > Restart).

## 6. .env Dosyasını Güncelleyin
Kullanıcıyı oluşturduktan sonra projedeki `.env` dosyasını güncelleyin:

```env
MSSQL_USER=mikro_sync_user
MSSQL_PASSWORD=BelirlediginizSifre
```
