require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function check01584Record() {
  try {
    console.log('01584 ürünü için kayıt kontrol ediliyor...\n');
    
    const stokHareket = await mssqlService.query(`
      SELECT TOP 1 *
      FROM STOK_HAREKETLERI
      WHERE sth_stok_kod = '01584' AND sth_cari_kodu = 'ACİL'
      ORDER BY sth_RECno DESC
    `);

    if (stokHareket.length > 0) {
      const sh = stokHareket[0];
      console.log('STOK_HAREKETLERI:');
      console.log(`  RECno: ${sh.sth_RECno}`);
      console.log(`  Stok: ${sh.sth_stok_kod}`);
      console.log(`  Cari: ${sh.sth_cari_kodu}`);
      console.log(`  Evrak: ${sh.sth_evrakno_seri}${sh.sth_evrakno_sira}`);
      console.log(`  Create Date: ${sh.sth_create_date}`);
      console.log(`  Lastup Date: ${sh.sth_lastup_date}`);
      console.log(`  Fat RecID RecNo: ${sh.sth_fat_recid_recno}`);
      console.log(`  Fis Tarihi: ${sh.sth_fis_tarihi}`);
      console.log(`  Special1: '${sh.sth_special1}'`);
      console.log(`  Special2: '${sh.sth_special2}'`);
      console.log(`  Special3: '${sh.sth_special3}'`);
      console.log(`  Satirno: ${sh.sth_satirno}`);
      console.log(`  Belge No: '${sh.sth_belge_no}'`);
      console.log(`  Isk Mas1: ${sh.sth_isk_mas1}`);
      console.log(`  Pos Satis: ${sh.sth_pos_satis}`);
      console.log(`  Promosyon FL: ${sh.sth_promosyon_fl}`);
      console.log(`  Cari Cinsi: ${sh.sth_cari_cinsi}`);
      console.log(`  Plasiyer Kodu: '${sh.sth_plasiyer_kodu}'`);
      console.log(`  Aciklama: '${sh.sth_aciklama}'`);
    } else {
      console.log('Kayıt bulunamadı!');
    }

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await mssqlService.disconnect();
    process.exit(0);
  }
}

check01584Record();
