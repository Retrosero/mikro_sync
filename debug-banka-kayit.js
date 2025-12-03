require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function debugBankaKayit() {
    try {
        // Banka kodları
        const bankaKodlari = await mssqlService.query('SELECT ban_kod FROM BANKALAR');
        const bankaCodes = bankaKodlari.map(b => `'${b.ban_kod}'`).join(',');

        console.log('Banka kodları:', bankaKodlari.map(b => b.ban_kod).join(', '));
        console.log();

        // Banka kodlu bir kayıt al
        const sample = await mssqlService.query(`
            SELECT TOP 5
                cha_kod, cha_ciro_cari_kodu, cha_meblag
            FROM CARI_HESAP_HAREKETLERI 
            WHERE cha_kod IN (${bankaCodes}) 
            AND cha_ciro_cari_kodu IS NOT NULL 
            AND cha_ciro_cari_kodu != ''
        `);

        console.log('Banka kodlu örnek kayıtlar:');
        console.table(sample);

        if (sample.length > 0) {
            // Bu isimleri Web'de ara
            for (const rec of sample) {
                const cariAdi = rec.cha_ciro_cari_kodu.trim();
                console.log(`\n"${cariAdi}" ismi Web'de aranıyor...`);

                const result = await pgService.query(
                    'SELECT id, cari_kodu, cari_adi FROM cari_hesaplar WHERE cari_adi = $1',
                    [cariAdi]
                );

                if (result.length > 0) {
                    console.log('✓ Bulundu:', result[0]);
                } else {
                    console.log('✗ Bulunamadı!');

                    // Benzer isimler var mı?
                    const similar = await pgService.query(
                        "SELECT id, cari_adi FROM cari_hesaplar WHERE cari_adi ILIKE $1 LIMIT 3",
                        [`%${cariAdi.substring(0, 10)}%`]
                    );
                    if (similar.length > 0) {
                        console.log('Benzer isimler:');
                        console.table(similar);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

debugBankaKayit();
