const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function testNewSale() {
    console.log('='.repeat(60));
    console.log('YENİ SATIŞ TEST');
    console.log('='.repeat(60));

    try {
        // Test için mapping'i sil
        const testSatisId = 'c157ace6-b19c-49b3-832e-ac4e2be90055';

        console.log('\n1. Mapping siliniyor...');
        await pgService.query('DELETE FROM int_satis_mapping WHERE web_satis_id = $1', [testSatisId]);
        console.log('   ✓ Mapping silindi');

        // ERP'deki kayıtları sil
        console.log('\n2. ERP kayıtları siliniyor...');
        const deleted = await mssqlService.query(`
            DELETE FROM STOK_HAREKETLERI WHERE sth_evrakno_seri = 'ST' AND sth_evrakno_sira = 51;
            DELETE FROM CARI_HESAP_HAREKETLERI WHERE cha_evrakno_seri = 'ST' AND cha_evrakno_sira = 51;
        `);
        console.log('   ✓ ERP kayıtları silindi');

        console.log('\n3. Satış verilerini kontrol et:');
        const satis = await pgService.query('SELECT id, notlar FROM satislar WHERE id = $1', [testSatisId]);
        const kalem = await pgService.query('SELECT iskonto1, iskonto2, notlar FROM satis_kalemleri WHERE satis_id = $1', [testSatisId]);

        console.log('   Satış Notları:', satis[0]?.notlar || '(boş)');
        console.log('   Kalem İskonto1:', kalem[0]?.iskonto1 || 0);
        console.log('   Kalem Notları:', kalem[0]?.notlar || '(boş)');

        console.log('\n4. Şimdi sync komutunu çalıştırın:');
        console.log('   node web-to-erp-sync.js sync');

    } catch (error) {
        console.error('HATA:', error.message);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

testNewSale();
