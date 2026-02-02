const satisTransformer = require('./transformers/satis.transformer');
const pgService = require('./services/postgresql.service');

async function testTransform() {
    try {
        const testSatisId = 'c157ace6-b19c-49b3-832e-ac4e2be90055';

        // Gerçek verileri al
        const satis = await pgService.query('SELECT * FROM satislar WHERE id = $1', [testSatisId]);
        const kalemler = await pgService.query('SELECT * FROM satis_kalemleri WHERE satis_id = $1', [testSatisId]);

        console.log('TRANSFORM TEST\n');
        console.log('='.repeat(60));

        console.log('\n1. GİRDİ VERİLERİ:');
        console.log('   webSatis.notlar:', satis[0].notlar || '(boş)');
        console.log('   webKalem.notlar:', kalemler[0].notlar || '(boş)');
        console.log('   webKalem.iskonto1:', kalemler[0].iskonto1);
        console.log('   webKalem.iskonto1 type:', typeof kalemler[0].iskonto1);
        console.log('   webKalem.iskonto1 value:', kalemler[0].iskonto1 || 0);

        console.log('\n2. TRANSFORM SONUCU:');
        const transformed = await satisTransformer.transformSatisKalem(kalemler[0], satis[0]);

        console.log('   sth_aciklama:', `"${transformed.sth_aciklama}"`);
        console.log('   sth_iskonto1:', transformed.sth_iskonto1);
        console.log('   sth_iskonto1 type:', typeof transformed.sth_iskonto1);

        console.log('\n3. DEĞERLENDİRME:');
        if (transformed.sth_aciklama === kalemler[0].notlar) {
            console.log('   ✅ Notlar doğru transform edildi');
        } else {
            console.log('   ❌ Notlar yanlış!');
            console.log('      Beklenen:', kalemler[0].notlar);
            console.log('      Gelen:', transformed.sth_aciklama);
        }

        if (transformed.sth_iskonto1 == kalemler[0].iskonto1) {
            console.log('   ✅ İskonto1 doğru transform edildi');
        } else {
            console.log('   ❌ İskonto1 yanlış!');
            console.log('      Beklenen:', kalemler[0].iskonto1);
            console.log('      Gelen:', transformed.sth_iskonto1);
        }

    } catch (error) {
        console.error('HATA:', error.message);
        console.error(error.stack);
    } finally {
        await pgService.disconnect();
    }
}

testTransform();
