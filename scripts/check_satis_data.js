const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function checkSatisData() {
    console.log('='.repeat(60));
    console.log('SATIŞ VERİLERİ KONTROLÜ');
    console.log('='.repeat(60));

    try {
        // Son satışı al
        const satislar = await pgService.query(`
            SELECT id, notlar, toplam_tutar, fatura_seri_no, fatura_sira_no
            FROM satislar 
            ORDER BY olusturma_tarihi DESC 
            LIMIT 1
        `);

        if (satislar.length === 0) {
            console.log('Satış bulunamadı!');
            return;
        }

        const satis = satislar[0];
        console.log('\n1. WEB SATIŞI:');
        console.log('   ID:', satis.id);
        console.log('   Notlar:', satis.notlar || '(boş)');
        console.log('   Fatura:', `${satis.fatura_seri_no}-${satis.fatura_sira_no}`);

        // Satış kalemlerini al
        const kalemler = await pgService.query(`
            SELECT stok_id, miktar, birim_fiyat, toplam_tutar, 
                   indirim_orani, iskonto1, iskonto2, iskonto3, iskonto4, iskonto5, iskonto6,
                   kdv_tutari, kdv_orani, notlar
            FROM satis_kalemleri 
            WHERE satis_id = $1
        `, [satis.id]);

        console.log('\n2. WEB SATIŞ KALEMLERİ:');
        kalemler.forEach((k, i) => {
            console.log(`   Kalem ${i + 1}:`);
            console.log(`     - Miktar: ${k.miktar}`);
            console.log(`     - Birim Fiyat: ${k.birim_fiyat}`);
            console.log(`     - Toplam: ${k.toplam_tutar}`);
            console.log(`     - İndirim Oranı: ${k.indirim_orani || 0}%`);
            console.log(`     - İskonto1: ${k.iskonto1 || 0}`);
            console.log(`     - İskonto2: ${k.iskonto2 || 0}`);
            console.log(`     - İskonto3: ${k.iskonto3 || 0}`);
            console.log(`     - Notlar: ${k.notlar || '(boş)'}`);
        });

        // ERP'deki karşılığını bul
        const erpSatis = await mssqlService.query(`
            SELECT TOP 1 sth_evrakno_seri, sth_evrakno_sira, sth_aciklama,
                   sth_iskonto1, sth_iskonto2, sth_iskonto3, sth_iskonto4, sth_iskonto5, sth_iskonto6,
                   sth_tutar, sth_vergi, sth_miktar, sth_stok_kod
            FROM STOK_HAREKETLERI
            WHERE sth_evrakno_seri = @seri AND sth_evrakno_sira = @sira
            ORDER BY sth_satirno
        `, { seri: satis.fatura_seri_no, sira: satis.fatura_sira_no });

        if (erpSatis.length === 0) {
            console.log('\n3. ERP\'DE KAYIT BULUNAMADI!');
            console.log('   Bu satış henüz ERP\'ye aktarılmamış olabilir.');
        } else {
            console.log('\n3. ERP STOK HAREKETLERİ:');
            erpSatis.forEach((e, i) => {
                console.log(`   Satır ${i + 1}:`);
                console.log(`     - Stok Kod: ${e.sth_stok_kod}`);
                console.log(`     - Miktar: ${e.sth_miktar}`);
                console.log(`     - Tutar: ${e.sth_tutar}`);
                console.log(`     - Açıklama: "${e.sth_aciklama || '(boş)'}"`);
                console.log(`     - İskonto1: ${e.sth_iskonto1}`);
                console.log(`     - İskonto2: ${e.sth_iskonto2}`);
                console.log(`     - İskonto3: ${e.sth_iskonto3}`);
                console.log(`     - İskonto4: ${e.sth_iskonto4}`);
                console.log(`     - İskonto5: ${e.sth_iskonto5}`);
                console.log(`     - İskonto6: ${e.sth_iskonto6}`);
            });

            // Karşılaştırma
            console.log('\n4. KARŞILAŞTIRMA:');
            if (erpSatis[0].sth_aciklama === satis.notlar) {
                console.log('   ✅ Notlar doğru aktarılmış');
            } else {
                console.log('   ❌ Notlar YANLIŞ!');
                console.log(`      Web: "${satis.notlar || '(boş)'}"`);
                console.log(`      ERP: "${erpSatis[0].sth_aciklama || '(boş)'}"`);
            }

            // İskonto kontrolü
            const webIskonto1 = kalemler[0]?.iskonto1 || 0;
            if (erpSatis[0].sth_iskonto1 == webIskonto1) {
                console.log('   ✅ İskonto1 doğru aktarılmış');
            } else {
                console.log('   ❌ İskonto1 YANLIŞ!');
                console.log(`      Web: ${webIskonto1}`);
                console.log(`      ERP: ${erpSatis[0].sth_iskonto1}`);
            }
        }

    } catch (error) {
        console.error('HATA:', error.message);
        console.error(error.stack);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

checkSatisData();
