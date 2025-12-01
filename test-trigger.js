require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function testTrigger() {
    try {
        console.log('='.repeat(70));
        console.log('TRIGGER TESTİ');
        console.log('='.repeat(70));

        const testKod = 'TRGTEST01';

        // 1. Test stoğu oluştur
        console.log(`\n1. Test stoğu oluşturuluyor: ${testKod}`);
        await mssqlService.query(`
            INSERT INTO STOKLAR (sto_kod, sto_isim, sto_pasif_fl)
            VALUES (@kod, 'Trigger Test', 0)
        `, { kod: testKod });
        console.log('   ✅ Stok oluşturuldu');

        // 2. Stoğu sil
        console.log(`\n2. Stok siliniyor...`);
        await mssqlService.query(`
            DELETE FROM STOKLAR WHERE sto_kod = @kod
        `, { kod: testKod });
        console.log('   ✅ Stok silindi');

        // 3. Log tablosunu kontrol et
        console.log(`\n3. Log tablosu kontrol ediliyor...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle

        const log = await mssqlService.query(`
            SELECT * FROM MIKRO_SYNC_DELETED_LOG 
            WHERE record_id = @kod
        `, { kod: testKod });

        if (log.length > 0) {
            console.log('   ✅ BAŞARILI: Trigger çalıştı!');
            console.log(`      Tablo: ${log[0].table_name}`);
            console.log(`      Kayıt: ${log[0].record_id}`);
            console.log(`      Tarih: ${log[0].deleted_at}`);

            // Temizlik
            await mssqlService.query(`
                DELETE FROM MIKRO_SYNC_DELETED_LOG WHERE record_id = @kod
            `, { kod: testKod });
        } else {
            console.log('   ❌ BAŞARISIZ: Trigger çalışmadı!');
        }

        console.log('\n' + '='.repeat(70));
        console.log('ÖNEMLİ NOT:');
        console.log('Mikro ERP\'de stok silme işlemi genellikle "hard delete" değil,');
        console.log('"pasif işaretleme" (sto_pasif_fl = 1) şeklinde yapılır.');
        console.log('Bu durumda trigger tetiklenmez.');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

testTrigger();
