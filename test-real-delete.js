require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function testRealDelete() {
    try {
        console.log('GERCEK SILME TESTI');
        console.log('='.repeat(50));

        // 1. Mikro'da gerçekten var olan bir stoğu bul
        console.log('\n1. Mevcut bir stok araniyor...');
        const stok = await mssqlService.query(`
            SELECT TOP 1 sto_kod, sto_isim 
            FROM STOKLAR 
            WHERE sto_kod LIKE 'TEST%'
            ORDER BY sto_create_date DESC
        `);

        if (stok.length === 0) {
            console.log('   TEST ile baslayan stok bulunamadi.');
            console.log('   Lutfen Mikro\'da manuel olarak bir stok silin.');
            console.log('   Sonra: node check-deleted-cari.js');
            return;
        }

        console.log(`   Bulundu: ${stok[0].sto_kod} - ${stok[0].sto_isim}`);

        // 2. Bu stoğu sil
        console.log('\n2. Stok siliniyor...');
        const stokKod = stok[0].sto_kod;

        await mssqlService.query(`DELETE FROM STOKLAR WHERE sto_kod = @kod`, { kod: stokKod });
        console.log('   Silindi!');

        // 3. Log kontrol et
        console.log('\n3. Log tablosu kontrol ediliyor...');
        await new Promise(r => setTimeout(r, 1000));

        const log = await mssqlService.query(`
            SELECT * FROM MIKRO_SYNC_DELETED_LOG 
            WHERE record_id = @kod
        `, { kod: stokKod });

        if (log.length > 0) {
            console.log('   BASARILI! Trigger calisti!');
            console.log(`   Tablo: ${log[0].table_name}`);
            console.log(`   Kayit: ${log[0].record_id}`);
        } else {
            console.log('   BASARISIZ! Trigger calismadi!');
            console.log('   Trigger tanimini kontrol edin.');
        }

        console.log('\n' + '='.repeat(50));

    } catch (error) {
        console.error('Hata:', error.message);
        console.log('\nNOT: Eger "foreign key constraint" hatasi aliyorsaniz,');
        console.log('bu stok baska tablolarda kullaniliyor demektir.');
        console.log('Lutfen Mikro arayuzunden manuel olarak bir stok silin.');
    } finally {
        await mssqlService.disconnect();
    }
}

testRealDelete();
