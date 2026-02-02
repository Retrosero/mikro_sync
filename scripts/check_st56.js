const mssqlService = require('../services/mssql.service');

async function checkST56() {
    try {
        console.log('ERP\'deki ST-56 kaydını kontrol ediyoruz...\n');

        const result = await mssqlService.query(`
            SELECT sth_evrakno_seri, sth_evrakno_sira, sth_stok_kod, sth_miktar, sth_tutar,
                   sth_aciklama, sth_iskonto1, sth_iskonto2, sth_iskonto3
            FROM STOK_HAREKETLERI
            WHERE sth_evrakno_seri = 'ST' AND sth_evrakno_sira = 56
        `);

        if (result.length === 0) {
            console.log('❌ ST-56 kaydı bulunamadı!');
        } else {
            console.log('✅ ST-56 kaydı bulundu:\n');
            result.forEach((r, i) => {
                console.log(`Satır ${i + 1}:`);
                console.log(`  Stok Kod: ${r.sth_stok_kod}`);
                console.log(`  Miktar: ${r.sth_miktar}`);
                console.log(`  Tutar: ${r.sth_tutar}`);
                console.log(`  Açıklama: "${r.sth_aciklama || '(boş)'}"`);
                console.log(`  İskonto1: ${r.sth_iskonto1}`);
                console.log(`  İskonto2: ${r.sth_iskonto2}`);
                console.log(`  İskonto3: ${r.sth_iskonto3}`);
                console.log('');
            });

            // Değerlendirme
            console.log('═'.repeat(60));
            console.log('SONUÇ:');
            console.log('═'.repeat(60));
            if (result[0].sth_iskonto1 > 0) {
                console.log('✅ İSKONTO BAŞARILI! İskonto1 = ' + result[0].sth_iskonto1);
            } else {
                console.log('❌ İSKONTO BAŞARISIZ! İskonto1 = 0');
            }

            if (result[0].sth_aciklama && result[0].sth_aciklama.trim() !== '') {
                console.log('✅ NOTLAR BAŞARILI! Açıklama = "' + result[0].sth_aciklama + '"');
            } else {
                console.log('❌ NOTLAR BAŞARISIZ! Açıklama boş.');
            }
            console.log('═'.repeat(60));
        }

    } catch (error) {
        console.error('HATA:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkST56();
