/**
 * Test: satislar.notlar -> sth_aciklama mapping
 */

const satisTransformer = require('./transformers/satis.transformer');

async function testNotlarMapping() {
    console.log('='.repeat(60));
    console.log('TEST: satislar.notlar -> sth_aciklama');
    console.log('='.repeat(60));

    // Test verisi
    const mockWebSatis = {
        id: 12345,
        cari_hesap_id: 1,
        satis_tarihi: new Date('2026-02-02'),
        fatura_seri_no: 'TEST',
        fatura_sira_no: 1,
        belge_no: 'TEST1',
        notlar: 'Bu bir test notudur. Müşteri özel istek belirtti.',
        toplam_tutar: 1000
    };

    const mockWebKalem = {
        stok_id: 1,
        miktar: 5,
        toplam_tutar: 1000,
        kdv_tutari: 180,
        kdv_orani: 18
    };

    try {
        console.log('\n1. Test verisi:');
        console.log('   satislar.notlar:', mockWebSatis.notlar);

        console.log('\n2. Transform işlemi yapılıyor...');
        const result = await satisTransformer.transformSatisKalem(mockWebKalem, mockWebSatis);

        console.log('\n3. Sonuç:');
        console.log('   sth_aciklama:', result.sth_aciklama);

        if (result.sth_aciklama === mockWebSatis.notlar) {
            console.log('\n✅ TEST BAŞARILI: notlar alanı sth_aciklama\'ya doğru şekilde aktarıldı!');
        } else {
            console.log('\n❌ TEST BAŞARISIZ: Değerler eşleşmiyor!');
            console.log('   Beklenen:', mockWebSatis.notlar);
            console.log('   Gelen:', result.sth_aciklama);
        }

        // Uzun not testi (255 karakterden fazla)
        console.log('\n4. Uzun not testi (255 karakter sınırı):');
        const longNote = 'A'.repeat(300);
        mockWebSatis.notlar = longNote;
        const result2 = await satisTransformer.transformSatisKalem(mockWebKalem, mockWebSatis);

        console.log('   Orijinal uzunluk:', longNote.length);
        console.log('   Kesilen uzunluk:', result2.sth_aciklama.length);

        if (result2.sth_aciklama.length === 255) {
            console.log('   ✅ 255 karakter sınırı doğru çalışıyor!');
        } else {
            console.log('   ❌ 255 karakter sınırı çalışmıyor!');
        }

        // Boş not testi
        console.log('\n5. Boş not testi:');
        mockWebSatis.notlar = null;
        const result3 = await satisTransformer.transformSatisKalem(mockWebKalem, mockWebSatis);
        console.log('   notlar = null -> sth_aciklama:', `"${result3.sth_aciklama}"`);

        if (result3.sth_aciklama === '') {
            console.log('   ✅ Boş değer doğru işleniyor!');
        } else {
            console.log('   ❌ Boş değer yanlış işlendi!');
        }

    } catch (error) {
        console.error('\n❌ HATA:', error.message);
        console.error(error.stack);
    }

    console.log('\n' + '='.repeat(60));
}

// Test çalıştır
testNotlarMapping().then(() => {
    console.log('Test tamamlandı.');
    process.exit(0);
}).catch(err => {
    console.error('Test hatası:', err);
    process.exit(1);
});
