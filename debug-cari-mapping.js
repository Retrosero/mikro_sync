require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function debugCariMapping() {
    try {
        const cariId = 'b93526f8-a403-462d-86b5-d04c3562209a';
        console.log(`Cari ID kontrol ediliyor: ${cariId}\n`);

        // Web'de cari bilgileri
        const webCari = await pgService.query('SELECT * FROM cari_hesaplar WHERE id = $1', [cariId]);

        if (webCari.length > 0) {
            console.log('Web Cari Bilgileri:');
            console.table(webCari[0]);

            const cariKodu = webCari[0].cari_kodu;
            const cariAdi = webCari[0].cari_adi;

            console.log(`\nERP'de cari aranıyor (Kod: ${cariKodu}, Ad: ${cariAdi})...`);

            // ERP'de cari kontrolü
            const erpCari = await mssqlService.query('SELECT cari_kod, cari_unvan1 FROM CARI_HESAPLAR WHERE cari_kod = @kod', { kod: cariKodu });

            if (erpCari.length > 0) {
                console.log('✓ Cari ERP\'de bulundu:');
                console.table(erpCari[0]);
            } else {
                console.log('✗ Cari ERP\'de BULUNAMADI!');

                // İsimle ara
                const erpCariIsim = await mssqlService.query(`SELECT cari_kod, cari_unvan1 FROM CARI_HESAPLAR WHERE cari_unvan1 LIKE '%${cariAdi.substring(0, 10)}%'`);
                if (erpCariIsim.length > 0) {
                    console.log('Benzer isimli cariler:');
                    console.table(erpCariIsim);
                }
            }

        } else {
            console.log('✗ Cari Web\'de BULUNAMADI!');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

debugCariMapping();
