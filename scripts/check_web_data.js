const pgService = require('../services/postgresql.service');

async function checkWebData() {
    try {
        const testSatisId = 'c157ace6-b19c-49b3-832e-ac4e2be90055';

        console.log('WEB VERİLERİ KONTROLÜ\n');
        console.log('='.repeat(60));

        const satis = await pgService.query('SELECT * FROM satislar WHERE id = $1', [testSatisId]);
        const kalemler = await pgService.query('SELECT * FROM satis_kalemleri WHERE satis_id = $1', [testSatisId]);

        console.log('\n1. SATISLAR TABLOSU:');
        console.log('   ID:', satis[0].id);
        console.log('   notlar:', satis[0].notlar || '(boş)');
        console.log('   iskonto1:', satis[0].iskonto1 || 0);
        console.log('   iskonto2:', satis[0].iskonto2 || 0);
        console.log('   fatura:', `${satis[0].fatura_seri_no}-${satis[0].fatura_sira_no}`);

        console.log('\n2. SATIS_KALEMLERI TABLOSU:');
        kalemler.forEach((k, i) => {
            console.log(`   Kalem ${i + 1}:`);
            console.log(`     stok_id: ${k.stok_id}`);
            console.log(`     miktar: ${k.miktar}`);
            console.log(`     birim_fiyat: ${k.birim_fiyat}`);
            console.log(`     toplam_tutar: ${k.toplam_tutar}`);
            console.log(`     notlar: ${k.notlar || '(boş)'}`);
            console.log(`     iskonto1: ${k.iskonto1 || 0}`);
            console.log(`     iskonto2: ${k.iskonto2 || 0}`);
            console.log(`     iskonto3: ${k.iskonto3 || 0}`);
        });

        console.log('\n3. ÖZET:');
        console.log(`   Satış başlığında notlar: ${satis[0].notlar ? 'VAR' : 'YOK'}`);
        console.log(`   Kalem notları: ${kalemler[0].notlar ? 'VAR' : 'YOK'}`);
        console.log(`   Kalem iskonto1: ${kalemler[0].iskonto1 || 0}`);

    } catch (error) {
        console.error('HATA:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkWebData();
