require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('SERHAN kodlu cari için test tahsilatları oluşturuluyor...');

        // 1. SERHAN carisini bul
        const cariResult = await pgService.query("SELECT * FROM cari_hesaplar WHERE cari_kodu = 'SERHAN'");

        if (cariResult.length === 0) {
            console.error("❌ HATA: 'SERHAN' kodlu cari bulunamadı! Lütfen önce cari senkronizasyonu yapın.");
            process.exit(1);
        }

        const serhanCari = cariResult[0];
        console.log(`✓ Cari Bulundu: ${serhanCari.unvan} (ID: ${serhanCari.id})`);

        // 2. Kasa ve Banka bilgilerini al
        const kasalar = await pgService.query("SELECT * FROM kasalar LIMIT 1");
        const bankalar = await pgService.query("SELECT * FROM bankalar LIMIT 1");

        const kasaId = kasalar.length > 0 ? kasalar[0].id : null;
        const bankaId = bankalar.length > 0 ? bankalar[0].id : null;
        const bankaAdi = bankalar.length > 0 ? bankalar[0].banka_adi : 'TEST BANKASI';

        if (!kasaId) console.warn("⚠ Uyarı: Kasa bulunamadı, nakit tahsilat hatalı olabilir.");
        if (!bankaId) console.warn("⚠ Uyarı: Banka bulunamadı, banka işlemleri hatalı olabilir.");

        // 3. Sıra numarası ayarları (Çakışmayı önlemek için yüksekten başlatıyoruz)
        // User fatura ayarlarını kontrol et
        const userAyarlari = await pgService.query("SELECT tahsilat_seri_no, tahsilat_sira_no FROM user_fatura_ayarlari LIMIT 1");
        let seriNo = 'S'; // SERHAN için S serisi kullanalım
        let startSiraNo = 15000; // Çakışmayı önlemek için 15000'den başlatıyorum

        if (userAyarlari.length > 0) {
            // Veritabanındaki ayarı ezmiyoruz ama referans alabiliriz. 
            // Manuel test olduğu için hardcode yüksek değer güvenli.
        }

        const bugun = new Date().toISOString().split('T')[0];
        let currentSira = startSiraNo;

        // 4. Tahsilatları Oluştur

        // --- NAKİT ---
        console.log('1. Nakit Tahsilat Ekleniyor...');
        await pgService.query(`
            INSERT INTO tahsilatlar (
                tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
                tutar, kasa_id, aciklama, tahsilat_durumu,
                tahsilat_seri_no, tahsilat_sira_no, olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
                $1, $2, $3, 'nakit',
                1000.00, $4, 'SERHAN Test Nakit Tahsilat', 'tahsil_edildi',
                $5, $6, NOW(), NOW()
            )
        `, [`SER-NAK-${Date.now()}`, serhanCari.id, bugun, kasaId, seriNo, currentSira++]);

        // --- ÇEK ---
        console.log('2. Çek Tahsilat Ekleniyor...');
        // Vade tarihi 30 gün sonra
        const vade30 = new Date(); vade30.setDate(vade30.getDate() + 30);
        await pgService.query(`
            INSERT INTO tahsilatlar (
                tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
                tutar, cek_no, cek_vade_tarihi, banka_adi, 
                aciklama, tahsilat_durumu, tahsilat_seri_no, tahsilat_sira_no, olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
                $1, $2, $3, 'cek',
                2500.00, $4, $5, $6,
                '/12345/TEST BANK/MERKEZ/123456', 'bekliyor', $7, $8, NOW(), NOW()
            )
        `, [`SER-CEK-${Date.now()}`, serhanCari.id, bugun, '12345', vade30.toISOString().split('T')[0], bankaAdi, seriNo, currentSira++]);

        // --- SENET ---
        console.log('3. Senet Tahsilat Ekleniyor...');
        // Vade tarihi 60 gün sonra
        const vade60 = new Date(); vade60.setDate(vade60.getDate() + 60);
        await pgService.query(`
            INSERT INTO tahsilatlar (
                tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
                tutar, vade_tarihi, banka_adi,
                aciklama, tahsilat_durumu, tahsilat_seri_no, tahsilat_sira_no, olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
                $1, $2, $3, 'senet',
                3000.00, $4, 'İSTANBUL - KADIKÖY', 
                'SERHAN Test Senet', 'bekliyor', $5, $6, NOW(), NOW()
            )
        `, [`SER-SEN-${Date.now()}`, serhanCari.id, bugun, vade60.toISOString().split('T')[0], seriNo, currentSira++]);

        // --- HAVALE ---
        console.log('4. Havale Tahsilat Ekleniyor...');
        await pgService.query(`
            INSERT INTO tahsilatlar (
                tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
                tutar, banka_id, aciklama, tahsilat_durumu,
                tahsilat_seri_no, tahsilat_sira_no, olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
                $1, $2, $3, 'havale',
                5000.00, $4, 'SERHAN Test Havale', 'tahsil_edildi',
                $5, $6, NOW(), NOW()
            )
        `, [`SER-HAV-${Date.now()}`, serhanCari.id, bugun, bankaId, seriNo, currentSira++]);

        // --- KREDİ KARTI ---
        console.log('5. Kredi Kartı Tahsilat Ekleniyor...');
        await pgService.query(`
            INSERT INTO tahsilatlar (
                tahsilat_no, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi,
                tutar, banka_id, aciklama, tahsilat_durumu,
                tahsilat_seri_no, tahsilat_sira_no, olusturma_tarihi, guncelleme_tarihi
            ) VALUES (
                $1, $2, $3, 'kredi_karti',
                750.00, $4, 'SERHAN Test KK', 'tahsil_edildi',
                $5, $6, NOW(), NOW()
            )
        `, [`SER-KK-${Date.now()}`, serhanCari.id, bugun, bankaId, seriNo, currentSira++]);

        console.log(`\n✓ Toplam 5 adet tahsilat kaydı oluşturuldu.`);
        console.log(`✓ 'sync_queue' tablosuna otomatik olarak trigger ile eklenmiş olmalılar.`);
        console.log(`✓ Şimdi 'npm run sync-web-to-erp' komutunu çalıştırabilirsiniz.`);

        await pgService.disconnect();

    } catch (error) {
        console.error('Beklenmeyen Hata:', error);
        process.exit(1);
    }
})();
