const mssqlService = require('./services/mssql.service');
const fs = require('fs');

async function exportWrong() {
  try {
    const query = `
      SELECT 
        cha_evrakno_seri as seri_no,
        cha_evrakno_sira as sira_no,
        cha_ciro_cari_kodu as asil_cari,
        cha_meblag as tutar,
        CONVERT(varchar, cha_tarihi, 104) as tarih
      FROM CARI_HESAP_HAREKETLERI WITH (NOLOCK)
      WHERE cha_evrak_tip = 63
        AND cha_grupno = 1
        AND cha_cari_cins IN (0, 4) -- Kasa(4) veya Açık(0) olmasına rağmen Banka gibi grupno=1 alanlar
      ORDER BY cha_tarihi DESC, cha_evrakno_sira DESC
    `;
    const rows = await mssqlService.query(query);

    let md = '# Hatalı Gönderilen Nakit/Açık Hesap Satış Faturası Kayıtları\n\n';
    md += 'Aşağıdaki liste `cha_grupno=1` (Kapalı Fatura - Banka formatında) olarak Mikroya aktifilen ancak Nakit Kasa veya Açık Hesap olarak eşlenen kayıtları listeler.\n\n';
    md += 'Toplam Hatalı Kayıt Sayısı: **' + rows.length + '**\n\n';
    md += '| İşlem Tarihi | Evrak Seri | Sıra No | Cari Kodu | Tutar |\n';
    md += '|---|---|---|---|---|\n';
    
    rows.forEach(r => {
      md += `| ${r.tarih} | ${r.seri_no} | ${r.sira_no} | ${r.asil_cari} | ${r.tutar} ₺ |\n`;
    });

    fs.writeFileSync('hatali_nakit_kayitlar.md', md, 'utf-8');
    console.log(`Dosya oluşturuldu ve ${rows.length} hatalı kayıt bulundu.`);
    process.exit(0);
  } catch (err) {
    console.error('Hata:', err);
    process.exit(1);
  }
}
exportWrong();
