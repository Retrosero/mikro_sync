require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function deleteSerhanHareket() {
    try {
        // Serhan cari kodu
        const cari = await mssqlService.query(`
            SELECT TOP 1 cari_kod FROM CARI_HESAPLAR 
            WHERE cari_kod LIKE '%SERHAN%' OR cari_unvan1 LIKE '%SERHAN%'
        `);

        if (cari.length === 0) {
            console.log('Serhan bulunamadi');
            return;
        }

        const cariKod = cari[0].cari_kod;
        console.log('Cari:', cariKod);

        // Son hareket
        const hareket = await mssqlService.query(`
            SELECT TOP 1 cha_RECno FROM CARI_HESAP_HAREKETLERI 
            WHERE cha_kod = @cariKod
            ORDER BY cha_create_date DESC
        `, { cariKod });

        if (hareket.length === 0) {
            console.log('Hareket bulunamadi');
            return;
        }

        const recno = hareket[0].cha_RECno;
        console.log('RECno:', recno);

        // Sil
        await mssqlService.query(`DELETE FROM CARI_HESAP_HAREKETLERI WHERE cha_RECno = @recno`, { recno });
        console.log('Silindi!');

        // Log kontrol
        await new Promise(r => setTimeout(r, 1000));
        const log = await mssqlService.query(`
            SELECT * FROM MIKRO_SYNC_DELETED_LOG 
            WHERE record_id = @recno
        `, { recno: recno.toString() });

        console.log('Log kayit sayisi:', log.length);
        if (log.length > 0) {
            console.log('TRIGGER CALISTI!');
        } else {
            console.log('TRIGGER CALISMADI!');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

deleteSerhanHareket();
