const mssqlService = require('./services/mssql.service');

async function findWrong() {
  try {
    const query = `
      SELECT TOP 500
        cha_evrakno_seri as seri_no,
        cha_evrakno_sira as sira_no,
        cha_kod as cari_kod,
        cha_ciro_cari_kodu as asil_cari,
        cha_meblag as tutar,
        CONVERT(varchar, cha_tarihi, 104) as tarih,
        cha_cari_cins as cari_cins
      FROM CARI_HESAP_HAREKETLERI WITH (NOLOCK)
      WHERE cha_evrak_tip = 63
        AND cha_grupno = 1
        AND cha_cari_cins IN (0, 4) -- Banka (2) hariç. (4: Kasa/Nakit, 0: Normal Cari)
      ORDER BY cha_tarihi DESC, cha_evrakno_sira DESC
    `;
    const rows = await mssqlService.query(query);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
findWrong();
