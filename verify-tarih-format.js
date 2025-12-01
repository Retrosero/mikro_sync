require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function verifyTarihFormat() {
  try {
    console.log('='.repeat(70));
    console.log('TARİH FORMATI DOĞRULAMA');
    console.log('='.repeat(70));
    console.log();

    // Son eklenen kayıtları kontrol et
    console.log('1. CARI_HESAP_HAREKETLERI - Son 5 kayıt:');
    const cariHareketler = await mssqlService.query(`
      SELECT TOP 5
        cha_RECno,
        cha_kod,
        cha_evrakno_sira,
        cha_create_date,
        cha_lastup_date,
        cha_create_user,
        cha_lastup_user
      FROM CARI_HESAP_HAREKETLERI
      ORDER BY cha_RECno DESC
    `);

    cariHareketler.forEach(h => {
      console.log(`\n  RECno: ${h.cha_RECno}`);
      console.log(`  Cari: ${h.cha_kod}`);
      console.log(`  Evrak: ${h.cha_evrakno_sira}`);
      console.log(`  Create Date: ${h.cha_create_date}`);
      console.log(`  Lastup Date: ${h.cha_lastup_date}`);
      console.log(`  Create User: ${h.cha_create_user}`);
      console.log(`  Lastup User: ${h.cha_lastup_user}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('2. STOK_HAREKETLERI - Son 5 kayıt:');
    const stokHareketler = await mssqlService.query(`
      SELECT TOP 5
        sth_RECno,
        sth_stok_kod,
        sth_evrakno_sira,
        sth_create_date,
        sth_lastup_date,
        sth_create_user,
        sth_lastup_user,
        sth_fat_recid_recno
      FROM STOK_HAREKETLERI
      ORDER BY sth_RECno DESC
    `);

    stokHareketler.forEach(h => {
      console.log(`\n  RECno: ${h.sth_RECno}`);
      console.log(`  Stok: ${h.sth_stok_kod}`);
      console.log(`  Evrak: ${h.sth_evrakno_sira}`);
      console.log(`  Create Date: ${h.sth_create_date}`);
      console.log(`  Lastup Date: ${h.sth_lastup_date}`);
      console.log(`  Create User: ${h.sth_create_user}`);
      console.log(`  Lastup User: ${h.sth_lastup_user}`);
      console.log(`  Fat RecID RecNo: ${h.sth_fat_recid_recno}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✓ DOĞRULAMA TAMAMLANDI');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await mssqlService.disconnect();
    process.exit(0);
  }
}

verifyTarihFormat();
