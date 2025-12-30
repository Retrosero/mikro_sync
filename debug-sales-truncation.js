const pgService = require('./services/postgresql.service');

async function debugSales() {
    try {
        await pgService.pool.connect();

        const salesIds = [
            'c30851ec-8750-4f4c-baae-8cc1285c7fe4',
            '13399d8f-c7a3-4855-861b-31d6affd3a08',
            'cc4b5cfd-1d3d-49a4-a8ca-c6b8e3253d32'
        ];

        for (const id of salesIds) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`Satış ID: ${id}`);
            console.log('='.repeat(80));

            // Satış başlık bilgileri
            const satis = await pgService.query(`
                SELECT s.*, c.cari_adi, c.cari_kodu,
                       LENGTH(c.cari_adi) as cari_adi_uzunluk,
                       LENGTH(s.notlar) as notlar_uzunluk,
                       LENGTH(s.satis_no) as satis_no_uzunluk,
                       LENGTH(s.fatura_seri_no) as seri_uzunluk
                FROM satislar s
                JOIN cari_hesaplar c ON c.id = s.cari_hesap_id
                WHERE s.id = $1
            `, [id]);

            if (satis.length > 0) {
                const s = satis[0];
                console.log('\n📋 BAŞLIK BİLGİLERİ:');
                console.log(`  Satış No: ${s.satis_no} (${s.satis_no_uzunluk} karakter)`);
                console.log(`  Seri No: ${s.fatura_seri_no || 'YOK'} (${s.seri_uzunluk || 0} karakter)`);
                console.log(`  Müşteri: ${s.cari_adi} (${s.cari_adi_uzunluk} karakter)`);
                console.log(`  Notlar: ${s.notlar || 'YOK'} (${s.notlar_uzunluk || 0} karakter)`);
                console.log(`  Toplam Tutar: ${s.toplam_tutar} TL`);

                // Birleşik açıklama
                const chaAciklama = s.cari_adi + (s.notlar ? ' - ' + s.notlar : '');
                console.log(`\n  ⚠️  cha_aciklama: "${chaAciklama}"`);
                console.log(`  ⚠️  Uzunluk: ${chaAciklama.length} karakter (Limit: 50)`);
                if (chaAciklama.length > 50) {
                    console.log(`  ❌ SORUN: ${chaAciklama.length - 50} karakter fazla!`);
                }
            }

            // Satış kalemleri
            const kalemler = await pgService.query(`
                SELECT sk.*, st.stok_adi, st.stok_kodu,
                       LENGTH(st.stok_adi) as stok_adi_uzunluk,
                       LENGTH(st.stok_kodu) as stok_kodu_uzunluk
                FROM satis_kalemleri sk
                JOIN stoklar st ON st.id = sk.stok_id
                WHERE sk.satis_id = $1
            `, [id]);

            console.log(`\n📦 KALEMLER (${kalemler.length} adet):`);
            kalemler.forEach((k, i) => {
                console.log(`\n  Kalem ${i + 1}:`);
                console.log(`    Stok Kodu: ${k.stok_kodu} (${k.stok_kodu_uzunluk} karakter)`);
                console.log(`    Stok Adı: ${k.stok_adi} (${k.stok_adi_uzunluk} karakter)`);
                console.log(`    Miktar: ${k.miktar}`);
                console.log(`    Birim Fiyat: ${k.birim_fiyat}`);

                if (k.stok_kodu_uzunluk > 25) {
                    console.log(`    ❌ SORUN: Stok kodu çok uzun! (Limit: 25)`);
                }
                if (k.stok_adi_uzunluk > 50) {
                    console.log(`    ❌ SORUN: Stok adı çok uzun! (Limit: 50)`);
                }
            });
        }

        console.log(`\n${'='.repeat(80)}\n`);

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
    }
}

debugSales();
