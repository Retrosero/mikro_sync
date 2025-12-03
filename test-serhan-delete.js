require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function testSerhanDelete() {
    try {
        console.log('='.repeat(70));
        console.log('SERHAN CARİ HAREKET SİLME TESTİ');
        console.log('='.repeat(70));

        // 1. Serhan cari kodunu bul
        console.log('\n1. Serhan cari kodu aranıyor...');
        const cari = await mssqlService.query(`
            SELECT TOP 1 cari_kod, cari_unvan1 
            FROM CARI_HESAPLAR 
            WHERE cari_kod LIKE '%SERHAN%' OR cari_unvan1 LIKE '%SERHAN%'
        `);

        if (cari.length === 0) {
            console.log('   Serhan carisi bulunamadi!');
            return;
        }

        const cariKod = cari[0].cari_kod;
        console.log(`   Bulundu: ${cariKod} - ${cari[0].cari_unvan1}`);

        // 2. Bu carinin son hareketini bul
        console.log('\n2. Son cari hareket aranıyor...');
        const hareket = await mssqlService.query(`
            SELECT TOP 1 
                cha_RECno,
                cha_evrakno_seri + '-' + CAST(cha_evrakno_sira AS VARCHAR) as evrak_no,
                cha_tarihi,
                cha_meblag
            FROM CARI_HESAP_HAREKETLERI 
            WHERE cha_kod = @cariKod
            ORDER BY cha_create_date DESC
        `, { cariKod });

        if (hareket.length === 0) {
            console.log('   Bu cariye ait hareket bulunamadi!');
            return;
        }

        const recno = hareket[0].cha_RECno;
        console.log(`   Bulundu: Evrak ${hareket[0].evrak_no}, Tutar: ${hareket[0].cha_meblag}`);
        console.log(`   RECno: ${recno}`);

        // 3. Web'de bu hareketin var olup olmadığını kontrol et
        console.log('\n3. Web tarafinda kontrol ediliyor...');
        const webHareket = await pgService.query(`
            SELECT COUNT(*) as cnt 
            FROM cari_hesap_hareketleri 
            WHERE erp_recno = $1
        `, [recno]);

        console.log(`   Web'de kayit sayisi: ${webHareket[0].cnt}`);

        // 4. MSSQL'den sil
        console.log('\n4. MSSQL\'den hareket siliniyor...');
        await mssqlService.query(`
            DELETE FROM CARI_HESAP_HAREKETLERI 
            WHERE cha_RECno = @recno
        `, { recno });
        console.log('   Silindi!');

        // 5. Log tablosunu kontrol et
        console.log('\n5. Log tablosu kontrol ediliyor...');
        await new Promise(r => setTimeout(r, 1000));

        const log = await mssqlService.query(`
            SELECT * FROM MIKRO_SYNC_DELETED_LOG 
            WHERE table_name = 'CARI_HESAP_HAREKETLERI' 
            AND record_id = @recno
        `, { recno: recno.toString() });

        if (log.length > 0) {
            console.log('   BASARILI! Trigger calisti!');
            console.log(`   Log ID: ${log[0].id}`);
            console.log(`   Tablo: ${log[0].table_name}`);
            console.log(`   Kayit: ${log[0].record_id}`);
        } else {
            console.log('   BASARISIZ! Trigger calismadi!');
            console.log('   CARI_HESAP_HAREKETLERI icin trigger yok olabilir.');
        }

        console.log('\n' + '='.repeat(70));
        console.log('SONRAKI ADIM:');
        console.log('  npm run sync-bidirectional');
        console.log('Bu komutu calistirinca Web\'deki hareket de silinecek.');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

testSerhanDelete();
