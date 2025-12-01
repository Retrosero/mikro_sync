require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkEvrak() {
  try {
    console.log('Evrak 4548 kontrol ediliyor...\n');
    
    const stokHareketler = await mssqlService.query(`
      SELECT TOP 10 *
      FROM STOK_HAREKETLERI
      WHERE sth_evrakno_sira = 4548
      ORDER BY sth_RECno DESC
    `);
    
    console.log(`Stok hareketleri: ${stokHareketler.length}`);
    stokHareketler.forEach(h => {
      console.log(`  - RECno: ${h.sth_RECno}, Tip: ${h.sth_evraktip}, Seri: '${h.sth_evrakno_seri}', Stok: ${h.sth_stok_kod}`);
    });
    
    console.log();
    
    const cariHareketler = await mssqlService.query(`
      SELECT TOP 10 *
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrakno_sira = 4548
      ORDER BY cha_RECno DESC
    `);
    
    console.log(`Cari hareketler: ${cariHareketler.length}`);
    cariHareketler.forEach(h => {
      console.log(`  - RECno: ${h.cha_RECno}, Tip: ${h.cha_evrak_tip}, Seri: '${h.cha_evrakno_seri}', Cari: ${h.cha_kod}`);
    });

  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await mssqlService.disconnect();
    process.exit(0);
  }
}

checkEvrak();
