require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkEvrakKalemler() {
  try {
    const evrakNo = process.argv[2] || '4549';
    console.log(`\nEvrak ${evrakNo} - KALEM DETAYLARI\n`);
    
    const result = await mssqlService.query(`
      SELECT 
        sth_evrakno_sira, 
        sth_satirno, 
        sth_stok_kod, 
        sth_miktar, 
        sth_tutar,
        sth_cari_kodu
      FROM STOK_HAREKETLERI 
      WHERE sth_evrakno_sira = ${evrakNo}
      ORDER BY sth_satirno
    `);
    
    if (result.length === 0) {
      console.log('Kayıt bulunamadı!');
      return;
    }
    
    console.log(`Cari: ${result[0].sth_cari_kodu}`);
    console.log(`Toplam ${result.length} kalem:\n`);
    
    let toplamTutar = 0;
    result.forEach(r => {
      console.log(`  Satır ${r.sth_satirno}: ${r.sth_stok_kod} x ${r.sth_miktar} = ${r.sth_tutar} TL`);
      toplamTutar += parseFloat(r.sth_tutar);
    });
    
    console.log(`\nTOPLAM: ${toplamTutar} TL\n`);
    
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

checkEvrakKalemler();
