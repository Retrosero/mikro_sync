const pgService = require('./services/postgresql.service');

async function main() {
    try {
        // Son 10 satis
        const satislar = await pgService.query(`SELECT id, belge_no, fatura_seri_no, fatura_sira_no, satis_tarihi, toplam_tutar, cari_hesap_id FROM satislar ORDER BY id DESC LIMIT 10`);
        console.log('Son 10 satis:');
        console.table(satislar);

        // int_satis_mapping toplam
        const mapping = await pgService.query(`SELECT COUNT(*) as total FROM int_satis_mapping`);
        console.log('\nint_satis_mapping toplam:', mapping[0].total);

        // Son 5 mapping
        const lastMapping = await pgService.query(`SELECT web_satis_id, erp_evrak_seri, erp_evrak_no, aktarim_tarihi FROM int_satis_mapping ORDER BY aktarim_tarihi DESC LIMIT 5`);
        console.log('Son 5 mapping:', lastMapping);

        // Satislar tablosunda ERP'ye aktarilmamis kayitlar (mapping yok)
        const unmapped = await pgService.query(`
            SELECT s.id, s.belge_no, s.satis_tarihi, s.toplam_tutar, s.cari_hesap_id
            FROM satislar s
            LEFT JOIN int_satis_mapping m ON s.id = m.web_satis_id
            WHERE m.web_satis_id IS NULL
            ORDER BY s.id DESC
            LIMIT 10
        `);
        console.log('\nERP ye aktarilmamis satislar (mapping yok):');
        console.table(unmapped);

        // Toplam satis sayisi
        const totalSatis = await pgService.query(`SELECT COUNT(*) as total FROM satislar`);
        console.log('\nToplam satis sayisi:', totalSatis[0].total);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
