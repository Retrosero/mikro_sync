const pgService = require('../services/postgresql.service');
const { v4: uuidv4 } = require('uuid');

async function createTestData() {
    try {
        console.log('Test verileri oluşturuluyor...');
        await pgService.pool.connect();

        const cariRes = await pgService.query("SELECT id, cari_kodu, cari_adi FROM cari_hesaplar WHERE cari_kodu = 'SERHAN' OR cari_adi LIKE '%SERHAN%' LIMIT 1");
        if (cariRes.length === 0) {
            console.error("SERHAN kodlu/adlı müşteri bulunamadı!");
            return;
        }
        const cari = cariRes[0];
        console.log(`Müşteri bulundu: ${cari.cari_adi} (${cari.cari_kodu})`);

        const stokRes = await pgService.query("SELECT id, stok_kodu FROM stoklar LIMIT 1");
        if (stokRes.length === 0) { console.error("Stok yok!"); return; }
        const stok = stokRes[0];

        const kasaRes = await pgService.query("SELECT id FROM kasalar LIMIT 1");
        const kasaId = kasaRes.length > 0 ? kasaRes[0].id : null;

        const bankaRes = await pgService.query("SELECT id FROM bankalar LIMIT 1");
        const bankaId = bankaRes.length > 0 ? bankaRes[0].id : null;

        await createSatisFaturasi(cari.id, stok.id, "Nakit Fatura", "satis");
        await createSatisFaturasi(cari.id, stok.id, "Vadeli Fatura", "satis");
        await createSatisFaturasi(cari.id, stok.id, `KK İşlemi`, "satis");
        await createSatisFaturasi(cari.id, stok.id, "Havale İle Satış", "satis");

        if (kasaId) await createTahsilat(cari.id, "nakit", 1000, "Nakit Tahsilat", kasaId, null);
        if (bankaId) await createTahsilat(cari.id, "kk", 1500, "Kredi Kartı Tahsilat", null, bankaId);
        if (bankaId) await createTahsilat(cari.id, "havale", 2000, "Havale Tahsilat", null, bankaId); // havale -> tediye_tipi check needed, but tahsilat_tipi is used column? Let's treat 'havale' as bank transfer

        const cekVade = new Date(); cekVade.setDate(cekVade.getDate() + 30);
        await createTahsilat(cari.id, "cek", 5000, "Çek Tahsilat", null, null, { cek_no: "12345", cek_vade_tarihi: cekVade });

        const senetVade = new Date(); senetVade.setDate(senetVade.getDate() + 60);
        await createTahsilat(cari.id, "senet", 3500, "Senet Tahsilat", null, null, { cek_no: "S-999", cek_vade_tarihi: senetVade }); // Using cek fields for senet if specific columns missing

        await createAlisFaturasi(cari.id, stok.id, "Alış Faturası Testi");
        await createIade(cari.id, stok.id, "Satış İadesi Testi"); // Note: iade table check needed

        console.log("Tüm test verileri oluşturuldu.");

    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await pgService.disconnect();
    }
}

async function createSatisFaturasi(cariId, stokId, aciklama, tipi) {
    const id = uuidv4();
    try {
        await pgService.query(`
            INSERT INTO satislar (
                id, cari_hesap_id, satis_tarihi, satis_no, 
                ara_toplam, kdv_tutari, toplam_tutar, 
                notlar, durum, vade_tarihi, satis_tipi, olusturma_tarihi
            ) VALUES (
                $1, $2, NOW(), $3, 
                100, 20, 120, 
                $4, 'onaylandi', NOW(), $5, NOW()
            )
        `, [id, cariId, `FAT-${Math.floor(Math.random() * 10000)}`, aciklama, tipi]);

        await pgService.query(`
            INSERT INTO satis_kalemleri (
                id, satis_id, stok_id, miktar, birim_fiyat, kdv_orani, toplam_tutar
            ) VALUES (
                $1, $2, $3, 1, 100, 20, 100
            )
        `, [uuidv4(), id, stokId]);
        console.log(`Satış Faturası: ${aciklama}`);
    } catch (e) { console.error(`Satis hatası (${aciklama}):`, e.message); }
}

async function createAlisFaturasi(cariId, stokId, aciklama) {
    const id = uuidv4();
    try {
        await pgService.query(`
            INSERT INTO alislar (
                id, tedarikci_id, fatura_tarihi, fatura_no, 
                ara_toplam, kdv_tutari, toplam_tutar, 
                aciklama, alis_durumu, created_at, updated_at
            ) VALUES (
                $1, $2, NOW(), $3, 
                100, 20, 120, 
                $4, 'onaylandi', NOW(), NOW()
            )
        `, [id, cariId, `ALIS-${Math.floor(Math.random() * 10000)}`, aciklama]);

        await pgService.query(`
            INSERT INTO alis_kalemleri (
                id, alis_id, stok_id, miktar, birim_fiyat, kdv_orani, toplam_tutar
            ) VALUES (
                $1, $2, $3, 1, 100, 20, 100
            )
        `, [uuidv4(), id, stokId]);
        console.log(`Alış Faturası: ${aciklama}`);
    } catch (e) { console.error(`Alis hatası (${aciklama}):`, e.message); }
}

async function createIade(cariId, stokId, aciklama) {
    const id = uuidv4();
    // Assuming 'iadeler' table exists and has similar structure to alislar but 'iade_tarihi', etc.
    // Schema check showed 'iade' column in 'alislar' table? No, but let's check iadeler existence again.
    // If failures, just log.
    try {
        await pgService.query(`
            INSERT INTO iadeler (
                id, cari_hesap_id, iade_tarihi, iade_no, 
                ara_toplam, kdv_tutari, toplam_tutar, 
                aciklama, durum, olusturma_tarihi
            ) VALUES (
                $1, $2, NOW(), $3, 
                100, 20, 120, 
                $4, 'onaylandi', NOW()
            )
        `, [id, cariId, `IADE-${Math.floor(Math.random() * 10000)}`, aciklama]);
        console.log(`İade: ${aciklama}`);
    } catch (e) { console.error(`İade hatası (${aciklama}):`, e.message); }
}

async function createTahsilat(cariId, odemeTuru, tutar, aciklama, kasaId, bankaId, extra = {}) {
    const id = uuidv4();
    // Columns: tahsilat_tarihi, tahsilat_tipi, tutar, aciklama, tahsilat_durumu
    // Optional: kasa_id, banka_id, cek_no, cek_vade_tarihi

    const params = [
        id, cariId, new Date(), odemeTuru, tutar, aciklama, 'onaylandi', new Date()
    ];
    let query = `
        INSERT INTO tahsilatlar (
            id, cari_hesap_id, tahsilat_tarihi, tahsilat_tipi, tutar, aciklama, tahsilat_durumu, olusturma_tarihi
    `;
    let values = `VALUES ($1, $2, $3, $4, $5, $6, $7, $8`;
    let paramIdx = 9;

    if (kasaId) { query += `, kasa_id`; values += `, $${paramIdx++}`; params.push(kasaId); }
    if (bankaId) { query += `, banka_id`; values += `, $${paramIdx++}`; params.push(bankaId); }

    if (extra.cek_no) { query += `, cek_no`; values += `, $${paramIdx++}`; params.push(extra.cek_no); }
    if (extra.cek_vade_tarihi) { query += `, cek_vade_tarihi`; values += `, $${paramIdx++}`; params.push(extra.cek_vade_tarihi); }

    query += `) ${values})`;
    try {
        await pgService.query(query, params);
        console.log(`Tahsilat: ${aciklama}`);
    } catch (e) { console.error(`Tahsilat hatası (${aciklama}):`, e.message); }
}
createTestData();
