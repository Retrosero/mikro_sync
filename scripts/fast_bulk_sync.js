// fast_bulk_sync.js
// High‑performance bulk synchronization for large tables
// Uses PostgreSQL "INSERT ... ON CONFLICT" for upserts and batches.

const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const stokTransformer = require('../transformers/stok.transformer');
const eldekiMiktarProcessor = require('../sync-jobs/eldeki-miktar.processor');
const logger = require('../utils/logger');
const syncStateService = require('../services/sync-state.service');

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 4000;

// --- YARDIMCI FONKSİYONLAR ---

/**
 * Ana barkodları (barkod_tipi = 'ana') stoklar tablosuna günceller
 */
async function updateMainBarcodes() {
    try {
        await pgService.query(`
            UPDATE stoklar s
            SET barkod = ub.barkod,
                guncelleme_tarihi = NOW()
            FROM urun_barkodlari ub
            WHERE ub.stok_id = s.id 
              AND ub.barkod_tipi = 'ana'
              AND ub.aktif = true
              AND (s.barkod IS NULL OR s.barkod != ub.barkod)
        `);
    } catch (error) {
        logger.warn('Ana barkod güncelleme hatası:', error.message);
    }
}

/**
 * Ana fiyatları (ilk fiyat listesi) stoklar tablosuna günceller
 */
async function updateMainPrices() {
    try {
        // İlk fiyat listesindeki fiyatları ana fiyat olarak kullan
        const firstPriceList = await pgService.queryOne(`
            SELECT web_fiyat_tanimi_id 
            FROM int_kodmap_fiyat_liste 
            WHERE erp_liste_no = 1
        `);
        
        if (firstPriceList) {
            await pgService.query(`
                UPDATE stoklar s
                SET satis_fiyati = ufl.fiyat,
                    guncelleme_tarihi = NOW()
                FROM urun_fiyat_listeleri ufl
                WHERE ufl.stok_id = s.id 
                  AND ufl.fiyat_tanimi_id = $1
                  AND (s.satis_fiyati IS NULL OR s.satis_fiyati != ufl.fiyat)
            `, [firstPriceList.web_fiyat_tanimi_id]);
        }
    } catch (error) {
        logger.warn('Ana fiyat güncelleme hatası:', error.message);
    }
}

// --- STOK ---
async function bulkSyncStocks() {
    const direction = 'erp_to_web';
    let lastSync = await syncStateService.getLastSyncTime('STOKLAR', direction);
    logger.info(`📦 STOK Bulk Sync Başlıyor (${lastSync ? 'İnkremental' : 'Tam'})...`);

    const changed = await getChangedStocks(lastSync);
    logger.info(`   ${changed.length} kayıt bulundu.`);

    for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;
        for (const erp of batch) {
            const web = await stokTransformer.transformFromERP(erp);
            values.push(
                web.stok_kodu, web.stok_adi, web.birim_turu, web.alis_fiyati, web.satis_fiyati,
                web.aciklama, web.olcu, web.raf_kodu, web.ambalaj, web.koliadeti, web.aktif, new Date()
            );
            placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        }
        if (values.length === 0) continue;

        const sql = `INSERT INTO stoklar (
      stok_kodu, stok_adi, birim_turu, alis_fiyati, satis_fiyati,
      aciklama, olcu, raf_kodu, ambalaj, koliadeti, aktif, guncelleme_tarihi
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (stok_kodu) DO UPDATE SET
      stok_adi = EXCLUDED.stok_adi,
      birim_turu = EXCLUDED.birim_turu,
      alis_fiyati = EXCLUDED.alis_fiyati,
      satis_fiyati = EXCLUDED.satis_fiyati,
      aciklama = EXCLUDED.aciklama,
      olcu = EXCLUDED.olcu,
      raf_kodu = EXCLUDED.raf_kodu,
      ambalaj = EXCLUDED.ambalaj,
      koliadeti = EXCLUDED.koliadeti,
      aktif = EXCLUDED.aktif,
      guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
    WHERE stoklar.guncelleme_tarihi < EXCLUDED.guncelleme_tarihi 
       OR stoklar.guncelleme_tarihi IS NULL`;
        await pgService.query(sql, values);
        process.stdout.write(`\r   🚀 ${Math.min(i + BATCH_SIZE, changed.length)} / ${changed.length} stok aktarıldı...`);
    }
    console.log('');
    await syncStateService.updateSyncTime('STOKLAR', direction, changed.length, true);
}

async function getChangedStocks(lastSync) {
    let where = 'WHERE sto_pasif_fl = 0';
    const params = {};
    if (lastSync) {
        where += ' AND sto_lastup_date > @lastSync';
        params.lastSync = lastSync;
    }
    const query = `SELECT * FROM STOKLAR ${where} ORDER BY sto_lastup_date`;
    return await mssqlService.query(query, params);
}

// --- BARKOD ---
async function bulkSyncBarkod() {
    const direction = 'erp_to_web';
    let lastSync = await syncStateService.getLastSyncTime('BARKOD_TANIMLARI', direction);
    logger.info(`🏷️  BARKOD Bulk Sync Başlıyor (${lastSync ? 'İnkremental' : 'Tam'})...`);

    let where = 'WHERE 1=1';
    const params = {};
    if (lastSync) {
        where += ' AND bar_lastup_date > @lastSync';
        params.lastSync = lastSync;
    }
    const query = `SELECT bar_stokkodu, bar_kodu, bar_lastup_date FROM BARKOD_TANIMLARI ${where} ORDER BY bar_lastup_date`;
    const changed = await mssqlService.query(query, params);
    logger.info(`   ${changed.length} kayıt bulundu.`);

    // Stok ID cache
    const stokMaps = await pgService.query('SELECT id, stok_kodu FROM stoklar');
    const stokMap = new Map(stokMaps.map(s => [s.stok_kodu, s.id]));

    for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const erp of batch) {
            const stokId = stokMap.get(erp.bar_stokkodu);
            if (!stokId) continue;

            // Varsayılan değerler
            const web = {
                stok_id: stokId,
                barkod: erp.bar_kodu,
                barkod_tipi: 'ana',
                aktif: true,
                guncelleme_tarihi: new Date()
            };

            values.push(web.stok_id, web.barkod, web.barkod_tipi, web.aktif, web.guncelleme_tarihi);
            placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        }

        if (values.length === 0) continue;

        const sql = `INSERT INTO urun_barkodlari (
      stok_id, barkod, barkod_tipi, aktif, guncelleme_tarihi
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (barkod) DO UPDATE SET
      stok_id = EXCLUDED.stok_id,
      barkod_tipi = EXCLUDED.barkod_tipi,
      aktif = EXCLUDED.aktif,
      guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
    WHERE urun_barkodlari.guncelleme_tarihi < EXCLUDED.guncelleme_tarihi 
       OR urun_barkodlari.guncelleme_tarihi IS NULL`;

        await pgService.query(sql, values);
        
        // Ana barkodları stoklar tablosuna güncelle
        await updateMainBarcodes();
        process.stdout.write(`\r   🚀 ${Math.min(i + BATCH_SIZE, changed.length)} / ${changed.length} barkod aktarıldı...`);
    }
    console.log('');
    await syncStateService.updateSyncTime('BARKOD_TANIMLARI', direction, changed.length, true);
}

// --- FİYAT ---
async function bulkSyncPrices() {
    const direction = 'erp_to_web';
    let lastSync = await syncStateService.getLastSyncTime('STOK_SATIS_FIYAT_LISTELERI', direction);
    logger.info(`💰 FİYAT Bulk Sync Başlıyor (${lastSync ? 'İnkremental' : 'Tam'})...`);

    let where = 'WHERE sfiyat_fiyati > 0';
    const params = {};
    if (lastSync) {
        where += ' AND sfiyat_lastup_date > @lastSync';
        params.lastSync = lastSync;
    }
    const query = `SELECT sfiyat_stokkod, sfiyat_listesirano, sfiyat_fiyati, sfiyat_lastup_date FROM STOK_SATIS_FIYAT_LISTELERI ${where} ORDER BY sfiyat_lastup_date`;
    const changed = await mssqlService.query(query, params);
    logger.info(`   ${changed.length} kayıt bulundu.`);

    // Cache
    const stokMaps = await pgService.query('SELECT id, stok_kodu FROM stoklar');
    const stokMap = new Map(stokMaps.map(s => [s.stok_kodu, s.id]));

    const fiyatMaps = await pgService.query('SELECT web_fiyat_tanimi_id, erp_liste_no FROM int_kodmap_fiyat_liste');
    const fiyatMap = new Map(fiyatMaps.map(m => [m.erp_liste_no, m.web_fiyat_tanimi_id]));

    for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const erp of batch) {
            const stokId = stokMap.get(erp.sfiyat_stokkod);
            const tanimId = fiyatMap.get(erp.sfiyat_listesirano);

            if (!stokId || !tanimId) continue;

            values.push(stokId, tanimId, erp.sfiyat_fiyati, new Date(), new Date());
            placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        }

        if (values.length === 0) continue;

        const sql = `INSERT INTO urun_fiyat_listeleri (
      stok_id, fiyat_tanimi_id, fiyat, olusturma_tarihi, guncelleme_tarihi
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (stok_id, fiyat_tanimi_id) DO UPDATE SET
      fiyat = EXCLUDED.fiyat,
      guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
    WHERE urun_fiyat_listeleri.guncelleme_tarihi < EXCLUDED.guncelleme_tarihi 
       OR urun_fiyat_listeleri.guncelleme_tarihi IS NULL`;

        await pgService.query(sql, values);
        
        // Ana fiyatları stoklar tablosuna güncelle
        await updateMainPrices();
        process.stdout.write(`\r   🚀 ${Math.min(i + BATCH_SIZE, changed.length)} / ${changed.length} fiyat aktarıldı...`);
    }
    console.log('');
    await syncStateService.updateSyncTime('STOK_SATIS_FIYAT_LISTELERI', direction, changed.length, true);
}

// --- CARİ ---
async function bulkSyncCari() {
    const direction = 'erp_to_web';
    let lastSync = await syncStateService.getLastSyncTime('CARI_HESAPLAR', direction);
    logger.info(`👥 CARİ Bulk Sync Başlıyor (${lastSync ? 'İnkremental' : 'Tam'})...`);

    let where = 'WHERE 1=1';
    const params = {};
    if (lastSync) {
        where += ' AND cari_lastup_date > @lastSync';
        params.lastSync = lastSync;
    }
    const query = `
    SELECT cari_kod, cari_unvan1, cari_unvan2, cari_CepTel, cari_EMail, cari_vdaire_adi, cari_vdaire_no, cari_lastup_date
    FROM CARI_HESAPLAR ${where} ORDER BY cari_lastup_date`;

    const changed = await mssqlService.query(query, params);
    logger.info(`   ${changed.length} kayıt bulundu.`);

    for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const erp of batch) {
            const web = {
                cari_kodu: erp.cari_kod,
                cari_adi: (erp.cari_unvan1 + ' ' + (erp.cari_unvan2 || '')).trim(),
                telefon: erp.cari_CepTel,
                eposta: erp.cari_EMail,
                vergi_dairesi: erp.cari_vdaire_adi,
                vergi_no: erp.cari_vdaire_no,
                guncelleme_tarihi: new Date()
            };

            values.push(web.cari_kodu, web.cari_adi, web.telefon, web.eposta, web.vergi_dairesi, web.vergi_no, web.guncelleme_tarihi);
            placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        }

        if (values.length === 0) continue;

        const sql = `INSERT INTO cari_hesaplar (
      cari_kodu, cari_adi, telefon, eposta, vergi_dairesi, vergi_no, guncelleme_tarihi
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (cari_kodu) DO UPDATE SET
      cari_adi = EXCLUDED.cari_adi,
      telefon = EXCLUDED.telefon,
      eposta = EXCLUDED.eposta,
      vergi_dairesi = EXCLUDED.vergi_dairesi,
      vergi_no = EXCLUDED.vergi_no,
      guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
    WHERE cari_hesaplar.guncelleme_tarihi < EXCLUDED.guncelleme_tarihi 
       OR cari_hesaplar.guncelleme_tarihi IS NULL`;

        await pgService.query(sql, values);
        process.stdout.write(`\r   🚀 ${Math.min(i + BATCH_SIZE, changed.length)} / ${changed.length} cari aktarıldı...`);
    }
    console.log('');
    await syncStateService.updateSyncTime('CARI_HESAPLAR', direction, changed.length, true);
}

// --- CARİ HAREKET ---
async function bulkSyncCariHareket() {
    const direction = 'erp_to_web';
    let lastSync = await syncStateService.getLastSyncTime('CARI_HESAP_HAREKETLERI', direction);
    logger.info(`📄 CARİ HAREKET Bulk Sync Başlıyor (${lastSync ? 'İnkremental' : 'Tam'})...`);

    let where = 'WHERE 1=1';
    const params = {};
    if (lastSync) {
        where += ' AND cha_lastup_date > @lastSync';
        params.lastSync = lastSync;
    }
    const query = `
    SELECT cha_RECno, cha_tarihi, cha_evrakno_seri, cha_evrakno_sira, cha_kod, cha_meblag, cha_aciklama, cha_lastup_date, cha_tip
    FROM CARI_HESAP_HAREKETLERI ${where} ORDER BY cha_lastup_date`;

    const changed = await mssqlService.query(query, params);
    logger.info(`   ${changed.length} kayıt bulundu.`);

    // Cari ID Cache
    const cariMaps = await pgService.query('SELECT id, cari_kodu FROM cari_hesaplar');
    const cariMap = new Map(cariMaps.map(c => [c.cari_kodu, c.id]));

    for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const erp of batch) {
            let cariId = cariMap.get(erp.cha_kod);
            
            // Eğer cari bulunamazsa, otomatik oluştur
            if (!cariId) {
                try {
                    const newCari = await pgService.queryOne(`
                        INSERT INTO cari_hesaplar (cari_kodu, cari_adi, olusturma_tarihi, guncelleme_tarihi)
                        VALUES ($1, $2, NOW(), NOW())
                        RETURNING id
                    `, [erp.cha_kod, `[Otomatik] Cari ${erp.cha_kod}`]);
                    
                    cariId = newCari.id;
                    cariMap.set(erp.cha_kod, cariId);
                    logger.info(`Otomatik cari oluşturuldu: ${erp.cha_kod}`);
                } catch (e) {
                    logger.warn(`Cari oluşturulamadı (${erp.cha_kod}): ${e.message}`);
                    continue;
                }
            }

            // cha_tip: 0 (Borç/Satış) -> cikis, 1 (Alacak/Tahsilat) -> giris
            const hareketTipi = erp.cha_tip === 0 ? 'cikis' : 'giris';



            const web = {
                erp_recno: erp.cha_RECno,
                cari_hesap_id: cariId,
                islem_tarihi: erp.cha_tarihi,
                hareket_tipi: hareketTipi,
                belge_no: (erp.cha_evrakno_seri || '') + (erp.cha_evrakno_sira || ''),
                tutar: erp.cha_meblag,
                onceki_bakiye: 0,
                sonraki_bakiye: 0,
                aciklama: erp.cha_aciklama,
                guncelleme_tarihi: new Date()
            };

            values.push(web.erp_recno, web.cari_hesap_id, web.islem_tarihi, web.hareket_tipi, web.belge_no, web.tutar, web.onceki_bakiye, web.sonraki_bakiye, web.aciklama, web.guncelleme_tarihi);
            placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        }

        if (values.length === 0) continue;

        const sql = `INSERT INTO cari_hesap_hareketleri (
      erp_recno, cari_hesap_id, islem_tarihi, hareket_tipi, belge_no, tutar, onceki_bakiye, sonraki_bakiye, aciklama, guncelleme_tarihi
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (erp_recno) DO UPDATE SET
      cari_hesap_id = EXCLUDED.cari_hesap_id,
      islem_tarihi = EXCLUDED.islem_tarihi,
      hareket_tipi = EXCLUDED.hareket_tipi,
      belge_no = EXCLUDED.belge_no,
      tutar = EXCLUDED.tutar,
      onceki_bakiye = EXCLUDED.onceki_bakiye,
      sonraki_bakiye = EXCLUDED.sonraki_bakiye,
      aciklama = EXCLUDED.aciklama,
      guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
    WHERE cari_hesap_hareketleri.guncelleme_tarihi < EXCLUDED.guncelleme_tarihi 
       OR cari_hesap_hareketleri.guncelleme_tarihi IS NULL`;

        await pgService.query(sql, values);
        process.stdout.write(`\r   🚀 ${Math.min(i + BATCH_SIZE, changed.length)} / ${changed.length} cari hareket aktarıldı...`);
    }
    console.log('');
    await syncStateService.updateSyncTime('CARI_HESAP_HAREKETLERI', direction, changed.length, true);
}

// --- STOK HAREKET ---
async function bulkSyncStokHareket() {
    const direction = 'erp_to_web';
    let lastSync = await syncStateService.getLastSyncTime('STOK_HAREKETLERI', direction);
    logger.info(`🚚 STOK HAREKET Bulk Sync Başlıyor (${lastSync ? 'İnkremental' : 'Tam'})...`);

    let where = 'WHERE 1=1';
    const params = {};
    if (lastSync) {
        where += ' AND sth_lastup_date > @lastSync';
        params.lastSync = lastSync;
    }
    const query = `
    SELECT sth_RECno, sth_stok_kod, sth_cari_kodu, sth_tarih, sth_evrakno_seri, sth_evrakno_sira, sth_miktar, sth_tutar, sth_lastup_date, sth_tip
    FROM STOK_HAREKETLERI ${where} ORDER BY sth_lastup_date`;

    const changed = await mssqlService.query(query, params);
    logger.info(`   ${changed.length} kayıt bulundu.`);

    // Caches
    const stokMaps = await pgService.query('SELECT id, stok_kodu FROM stoklar');
    const stokMap = new Map(stokMaps.map(s => [s.stok_kodu, s.id]));

    const cariMaps = await pgService.query('SELECT id, cari_kodu FROM cari_hesaplar');
    const cariMap = new Map(cariMaps.map(c => [c.cari_kodu, c.id]));

    for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const erp of batch) {
            const stokId = stokMap.get(erp.sth_stok_kod);
            let cariId = cariMap.get(erp.sth_cari_kodu);

            if (!stokId) continue;
            
            // Eğer cari bulunamazsa, otomatik oluştur
            if (!cariId) {
                try {
                    const newCari = await pgService.queryOne(`
                        INSERT INTO cari_hesaplar (cari_kodu, cari_adi, olusturma_tarihi, guncelleme_tarihi)
                        VALUES ($1, $2, NOW(), NOW())
                        RETURNING id
                    `, [erp.sth_cari_kodu, `[Otomatik] Cari ${erp.sth_cari_kodu}`]);
                    
                    cariId = newCari.id;
                    cariMap.set(erp.sth_cari_kodu, cariId);
                    logger.info(`Otomatik cari oluşturuldu: ${erp.sth_cari_kodu}`);
                } catch (e) {
                    logger.warn(`Cari oluşturulamadı (${erp.sth_cari_kodu}): ${e.message}`);
                    continue;
                }
            }

            // sth_tip: 0 (Giriş/Alış) -> giris, 1 (Çıkış/Satış) -> cikis
            const hareketTipi = erp.sth_tip === 0 ? 'giris' : 'cikis';

            const web = {
                erp_recno: erp.sth_RECno,
                stok_id: stokId,
                cari_hesap_id: cariId,
                islem_tarihi: erp.sth_tarih,
                hareket_tipi: hareketTipi,
                belge_no: (erp.sth_evrakno_seri || '') + (erp.sth_evrakno_sira || ''),
                miktar: erp.sth_miktar,
                onceki_miktar: 0,
                sonraki_miktar: 0,
                toplam_tutar: erp.sth_tutar,
                guncelleme_tarihi: new Date()
            };

            values.push(web.erp_recno, web.stok_id, web.cari_hesap_id, web.islem_tarihi, web.hareket_tipi, web.belge_no, web.miktar, web.onceki_miktar, web.sonraki_miktar, web.toplam_tutar, web.guncelleme_tarihi);
            placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        }

        if (values.length === 0) continue;

        const sql = `INSERT INTO stok_hareketleri (
      erp_recno, stok_id, cari_hesap_id, islem_tarihi, hareket_tipi, belge_no, miktar, onceki_miktar, sonraki_miktar, toplam_tutar, guncelleme_tarihi
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (erp_recno) DO UPDATE SET
      stok_id = EXCLUDED.stok_id,
      cari_hesap_id = EXCLUDED.cari_hesap_id,
      islem_tarihi = EXCLUDED.islem_tarihi,
      hareket_tipi = EXCLUDED.hareket_tipi,
      belge_no = EXCLUDED.belge_no,
      miktar = EXCLUDED.miktar,
      onceki_miktar = EXCLUDED.onceki_miktar,
      sonraki_miktar = EXCLUDED.sonraki_miktar,
      toplam_tutar = EXCLUDED.toplam_tutar,
      guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
    WHERE stok_hareketleri.guncelleme_tarihi < EXCLUDED.guncelleme_tarihi 
       OR stok_hareketleri.guncelleme_tarihi IS NULL`;

        await pgService.query(sql, values);
        process.stdout.write(`\r   🚀 ${Math.min(i + BATCH_SIZE, changed.length)} / ${changed.length} stok hareket aktarıldı...`);
    }
    console.log('');
    await syncStateService.updateSyncTime('STOK_HAREKETLERI', direction, changed.length, true);
}

(async () => {
    try {
        // Triggerları devre dışı bırak
        const tables = ['stoklar', 'urun_barkodlari', 'urun_fiyat_listeleri', 'cari_hesaplar', 'cari_hesap_hareketleri', 'stok_hareketleri'];
        for (const table of tables) {
            try {
                await pgService.query(`ALTER TABLE ${table} DISABLE TRIGGER ALL`);
            } catch (e) {
                logger.warn(`Trigger devre dışı bırakılamadı (${table}): ${e.message}`);
            }
        }
        logger.info('🔒 Triggerlar geçici olarak devre dışı bırakıldı');

        await bulkSyncStocks();
        await bulkSyncBarkod();
        await bulkSyncPrices();
        await bulkSyncCari();
        await bulkSyncCariHareket();
        await bulkSyncStokHareket();
        
        // Eldeki miktar senkronizasyonu
        await eldekiMiktarProcessor.syncToWeb(null, BATCH_SIZE);

        logger.info('✅ Tüm bulk senkronizasyonları başarıyla tamamlandı');
    } catch (err) {
        logger.error('Bulk senkronizasyon hatası:', err);
        process.exit(1);
    } finally {
        // Triggerları tekrar etkinleştir
        const tables = ['stoklar', 'urun_barkodlari', 'urun_fiyat_listeleri', 'cari_hesaplar', 'cari_hesap_hareketleri', 'stok_hareketleri'];
        for (const table of tables) {
            try {
                await pgService.query(`ALTER TABLE ${table} ENABLE TRIGGER ALL`);
            } catch (e) {
                logger.warn(`Trigger etkinleştirilemedi (${table}): ${e.message}`);
            }
        }
        logger.info('🔓 Triggerlar tekrar etkinleştirildi');

        await mssqlService.disconnect();
        await pgService.disconnect();
    }
})();
