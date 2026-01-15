require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const stockXmlService = require('../services/stock-xml.service');
const invoiceSettingsService = require('../services/invoice-settings.service');
const { runSync: runEntegraSync } = require('./entegra-sync');

// Env'den batch size al veya varsayılan 5000 kullan
const BATCH_SIZE = process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : 5000;

// Yardımcı: Bulk Insert/Upsert Query Oluşturucu
function buildBulkUpsertQuery(tableName, columns, rows, conflictTarget, updateColumns, returnColumns = 'id') {
    if (rows.length === 0) return null;

    const placeholders = [];
    const values = [];
    let paramIndex = 1;

    rows.forEach(row => {
        const rowPlaceholders = [];
        columns.forEach(col => {
            rowPlaceholders.push(`$${paramIndex++}`);
            values.push(row[col]);
        });
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
    });

    let query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;

    if (conflictTarget) {
        query += ` ON CONFLICT (${conflictTarget}) DO UPDATE SET `;
        query += updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
    }

    if (returnColumns) {
        query += ` RETURNING ${returnColumns}`;
    }

    return { query, values };
}

async function bulkSyncCategories() {
    console.log('='.repeat(70));
    console.log('1. KATEGORİ SENKRONIZASYONU (ULTRA HIZLI)');
    console.log('='.repeat(70));

    try {
        const startTime = Date.now();

        // Ana grupları çek
        const anaGruplar = await mssqlService.query('SELECT san_kod, san_isim FROM STOK_ANA_GRUPLARI');
        console.log(`${anaGruplar.length} ana grup bulundu.`);

        // Mevcut ana grupları al
        const mevcutAnaGruplar = await pgService.query('SELECT id, erp_id FROM kategoriler WHERE level = 0 AND erp_id IS NOT NULL');
        const mevcutAnaMap = new Map(mevcutAnaGruplar.map(k => [k.erp_id, k.id]));

        // Yeni ve güncellenecek ana grupları ayır
        const yeniAnaGruplar = [];
        const guncellenecekAnaGruplar = [];

        anaGruplar.forEach(g => {
            if (mevcutAnaMap.has(g.san_kod)) {
                guncellenecekAnaGruplar.push({
                    id: mevcutAnaMap.get(g.san_kod),
                    kategori_adi: g.san_isim
                });
            } else {
                yeniAnaGruplar.push({
                    kategori_adi: g.san_isim,
                    is_erp_category: true,
                    erp_id: g.san_kod,
                    level: 0
                });
            }
        });

        // Yeni ana grupları ekle
        if (yeniAnaGruplar.length > 0) {
            const { query, values } = buildBulkUpsertQuery(
                'kategoriler',
                ['kategori_adi', 'is_erp_category', 'erp_id', 'level'],
                yeniAnaGruplar,
                null, // No conflict
                null,
                'id, erp_id'
            );
            const result = await pgService.query(query, values);
            result.forEach(r => mevcutAnaMap.set(r.erp_id, r.id));
        }

        // Mevcut ana grupları güncelle
        if (guncellenecekAnaGruplar.length > 0) {
            const placeholders = [];
            const values = [];
            let idx = 1;

            guncellenecekAnaGruplar.forEach(g => {
                values.push(g.id, g.kategori_adi);
                placeholders.push(`($${idx++}, $${idx++})`);
            });

            const updateQuery = `
                UPDATE kategoriler AS k
                SET kategori_adi = v.kategori_adi,
                    guncelleme_tarihi = NOW()
                FROM (VALUES ${placeholders.join(', ')}) AS v(id, kategori_adi)
                WHERE k.id = v.id::uuid
            `;
            await pgService.query(updateQuery, values);
        }

        console.log(`✓ ${anaGruplar.length} ana grup senkronize edildi (${yeniAnaGruplar.length} yeni, ${guncellenecekAnaGruplar.length} güncellendi).`);

        // Alt grupları çek
        const altGruplar = await mssqlService.query('SELECT sta_kod, sta_isim, sta_ana_grup_kod FROM STOK_ALT_GRUPLARI');
        console.log(`${altGruplar.length} alt grup bulundu.`);

        // Mevcut alt grupları al
        const mevcutAltGruplar = await pgService.query('SELECT id, erp_id FROM kategoriler WHERE level = 1 AND erp_id IS NOT NULL');
        const mevcutAltMap = new Map(mevcutAltGruplar.map(k => [k.erp_id, k.id]));

        const yeniAltGruplar = [];
        const guncellenecekAltGruplar = [];

        altGruplar.forEach(g => {
            const parentId = mevcutAnaMap.get(g.sta_ana_grup_kod);
            if (!parentId) return;

            if (mevcutAltMap.has(g.sta_kod)) {
                guncellenecekAltGruplar.push({
                    id: mevcutAltMap.get(g.sta_kod),
                    kategori_adi: g.sta_isim,
                    parent_id: parentId
                });
            } else {
                yeniAltGruplar.push({
                    kategori_adi: g.sta_isim,
                    is_erp_category: true,
                    erp_id: g.sta_kod,
                    level: 1,
                    parent_id: parentId
                });
            }
        });

        // Yeni alt grupları ekle
        if (yeniAltGruplar.length > 0) {
            const { query, values } = buildBulkUpsertQuery(
                'kategoriler',
                ['kategori_adi', 'is_erp_category', 'erp_id', 'level', 'parent_id'],
                yeniAltGruplar,
                null,
                null
            );
            await pgService.query(query, values);
        }

        // Mevcut alt grupları güncelle
        if (guncellenecekAltGruplar.length > 0) {
            const placeholders = [];
            const values = [];
            let idx = 1;

            guncellenecekAltGruplar.forEach(g => {
                values.push(g.id, g.kategori_adi, g.parent_id);
                placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
            });

            const updateQuery = `
                UPDATE kategoriler AS k
                SET kategori_adi = v.kategori_adi,
                    parent_id = v.parent_id::uuid,
                    guncelleme_tarihi = NOW()
                FROM (VALUES ${placeholders.join(', ')}) AS v(id, kategori_adi, parent_id)
                WHERE k.id = v.id::uuid
            `;
            await pgService.query(updateQuery, values);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✓ ${yeniAltGruplar.length + guncellenecekAltGruplar.length} alt grup senkronize edildi (${yeniAltGruplar.length} yeni, ${guncellenecekAltGruplar.length} güncellendi) - ${duration}sn.`);
        console.log();

    } catch (error) {
        console.error('Kategori senkronizasyon hatası:', error.message);
        throw error;
    }
}

async function bulkSyncStoklar() {
    console.log('='.repeat(70));
    console.log('2. STOK SENKRONIZASYONU (ULTRA HIZLI MOD)');
    console.log('='.repeat(70));

    try {
        // Kategorileri belleğe yükle
        const categories = await pgService.query('SELECT id, erp_id FROM kategoriler WHERE erp_id IS NOT NULL');
        const categoryMap = new Map(categories.map(c => [c.erp_id.trim(), c.id]));
        console.log(`${categoryMap.size} kategori eşleşmesi yüklendi.`);

        // Markaları belleğe yükle
        const markalar = await pgService.query('SELECT id, marka_adi FROM markalar WHERE aktif = true');
        const markaMap = new Map(markalar.map(m => [m.marka_adi.toUpperCase().trim(), m.id]));
        console.log(`${markaMap.size} marka eşleşmesi yüklendi.`);

        // Eldeki miktar verilerini al (STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW)
        const eldekiMiktarData = await mssqlService.query(`
            SELECT 
                sth_stok_kod as stok_kodu,
                sth_eldeki_miktar as eldeki_miktar
            FROM STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW
            WHERE sth_eldeki_miktar IS NOT NULL
        `);
        const eldekiMiktarMap = new Map(eldekiMiktarData.map(e => [e.stok_kodu, parseFloat(e.eldeki_miktar) || 0]));
        console.log(`${eldekiMiktarMap.size} eldeki miktar verisi yüklendi.`);

        const countResult = await mssqlService.query('SELECT COUNT(*) as count FROM STOKLAR WHERE sto_pasif_fl = 0');
        const totalCount = countResult[0].count;
        console.log(`Toplam ${totalCount} aktif stok bulundu.`);

        // PostgreSQL parametre sınırı (65535) kontrolü
        // Stoklar için 17 kolon kullanıyoruz
        const STOK_COLUMN_COUNT = 17;
        const STOK_BATCH_SIZE = Math.min(BATCH_SIZE, Math.floor(65000 / STOK_COLUMN_COUNT));

        if (STOK_BATCH_SIZE < BATCH_SIZE) {
            console.log(`Bilgi: PostgreSQL parametre sınırı nedeniyle batch boyutu ${BATCH_SIZE} -> ${STOK_BATCH_SIZE} olarak güncellendi.`);
        }

        let offset = 0;
        let totalProcessed = 0;

        while (offset < totalCount) {
            const batchStartTime = Date.now();

            const batch = await mssqlService.query(`
                SELECT 
                    sto_kod, sto_isim, sto_birim1_ad, sto_standartmaliyet,
                    sto_sektor_kodu, sto_reyon_kodu, sto_ambalaj_kodu, 
                    sto_kalkon_kodu, sto_marka_kodu,
                    sto_altgrup_kod, sto_anagrup_kod, sto_create_date
                FROM STOKLAR
                WHERE sto_pasif_fl = 0
                ORDER BY sto_kod
                OFFSET ${offset} ROWS
                FETCH NEXT ${STOK_BATCH_SIZE} ROWS ONLY
            `);

            if (batch.length === 0) break;

            // Stok kodlarını topla (barkod için)
            const stokKodlari = batch.map(s => s.sto_kod);

            // Her stok için ilk barkodu al (Chunking yaparak)
            const barkodMap = new Map();
            const CHUNK_SIZE = 1000;

            for (let i = 0; i < stokKodlari.length; i += CHUNK_SIZE) {
                const chunk = stokKodlari.slice(i, i + CHUNK_SIZE);

                const chunkBarkodlar = await mssqlService.query(`
                    SELECT bar_stokkodu, bar_kodu
                    FROM (
                        SELECT bar_stokkodu, bar_kodu,
                               ROW_NUMBER() OVER (PARTITION BY bar_stokkodu ORDER BY bar_RECno) as rn
                        FROM BARKOD_TANIMLARI
                        WHERE bar_stokkodu IN (${chunk.map((_, idx) => `@p${idx}`).join(',')})
                          AND bar_kodu IS NOT NULL 
                          AND bar_kodu != ''
                          AND bar_iptal = 0
                    ) ranked
                    WHERE rn = 1
                `, chunk.reduce((acc, kod, idx) => ({ ...acc, [`p${idx}`]: kod }), {}));

                chunkBarkodlar.forEach(b => barkodMap.set(b.bar_stokkodu, b.bar_kodu));
            }

            // Veriyi hazırla
            const stokRows = batch.map(erpStok => {
                let kategoriId = null;
                const altGrupKod = erpStok.sto_altgrup_kod ? erpStok.sto_altgrup_kod.trim() : null;
                const anaGrupKod = erpStok.sto_anagrup_kod ? erpStok.sto_anagrup_kod.trim() : null;

                if (altGrupKod && categoryMap.has(altGrupKod)) {
                    kategoriId = categoryMap.get(altGrupKod);
                } else if (anaGrupKod && categoryMap.has(anaGrupKod)) {
                    kategoriId = categoryMap.get(anaGrupKod);
                }

                // Marka eşleştirmesi
                let markaId = null;
                if (erpStok.sto_marka_kodu) {
                    const markaKodu = erpStok.sto_marka_kodu.toUpperCase().trim();
                    markaId = markaMap.get(markaKodu) || null;
                }

                let koliadeti = 0;
                if (erpStok.sto_kalkon_kodu) {
                    const parsed = parseInt(erpStok.sto_kalkon_kodu);
                    koliadeti = isNaN(parsed) ? 0 : parsed;
                }

                // Eldeki miktarı map'ten al
                const eldekiMiktar = eldekiMiktarMap.get(erpStok.sto_kod) || 0;

                // Barkodu map'ten al
                const barkod = barkodMap.get(erpStok.sto_kod) || null;

                return {
                    stok_kodu: erpStok.sto_kod,
                    stok_adi: erpStok.sto_isim,
                    birim_turu: erpStok.sto_birim1_ad || 'Adet',
                    alis_fiyati: erpStok.sto_standartmaliyet || 0,
                    satis_fiyati: 0, // Fiyat listesinden güncellenecek
                    aciklama: '',
                    olcu: erpStok.sto_sektor_kodu || '',
                    raf_kodu: erpStok.sto_reyon_kodu || '',
                    ambalaj: erpStok.sto_ambalaj_kodu || '',
                    koliadeti: koliadeti,
                    aktif: true,
                    kategori_id: kategoriId,
                    marka_id: markaId,
                    barkod: barkod,
                    eldeki_miktar: eldekiMiktar,
                    olusturma_tarihi: erpStok.sto_create_date || new Date(),
                    guncelleme_tarihi: new Date()
                };
            });

            // Bulk Upsert Stoklar
            const columns = ['stok_kodu', 'stok_adi', 'birim_turu', 'alis_fiyati', 'satis_fiyati', 'aciklama', 'olcu', 'raf_kodu', 'ambalaj', 'koliadeti', 'aktif', 'kategori_id', 'marka_id', 'barkod', 'eldeki_miktar', 'olusturma_tarihi', 'guncelleme_tarihi'];
            const updateColumns = ['stok_adi', 'birim_turu', 'alis_fiyati', 'olcu', 'raf_kodu', 'ambalaj', 'koliadeti', 'kategori_id', 'marka_id', 'barkod', 'eldeki_miktar', 'olusturma_tarihi', 'guncelleme_tarihi'];

            const { query, values } = buildBulkUpsertQuery('stoklar', columns, stokRows, 'stok_kodu', updateColumns, 'id, stok_kodu');

            const result = await pgService.query(query, values);

            // Mapping tablosunu güncelle (int_kodmap_stok)
            const mapRows = result.map(r => ({
                web_stok_id: r.id,
                erp_stok_kod: r.stok_kodu
            }));

            const { query: mapQuery, values: mapValues } = buildBulkUpsertQuery(
                'int_kodmap_stok',
                ['web_stok_id', 'erp_stok_kod'],
                mapRows,
                'erp_stok_kod',
                ['web_stok_id'],
                null
            );

            await pgService.query(mapQuery, mapValues);

            totalProcessed += batch.length;
            offset += STOK_BATCH_SIZE;
            const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
            console.log(`  Batch tamamlandı: ${totalProcessed}/${totalCount} stok (${batch.length} kayıt, ${batchDuration}sn)`);
        }

        console.log(`✓ ${totalProcessed} stok senkronize edildi.`);

        // EK: Kuyruk Temizleme
        await pgService.query(`
            DELETE FROM sync_queue 
            WHERE entity_type IN ('stoklar', 'stok') 
            AND status = 'pending'
        `);

        console.log();

    } catch (error) {
        console.error('Stok senkronizasyon hatası:', error.message);
        throw error;
    }
}

async function bulkSyncBarkodlar() {
    console.log('='.repeat(70));
    console.log('3. BARKOD SENKRONIZASYONU (ULTRA HIZLI MOD)');
    console.log('='.repeat(70));

    try {
        const countResult = await mssqlService.query('SELECT COUNT(*) as count FROM BARKOD_TANIMLARI');
        const totalCount = countResult[0].count;
        console.log(`Toplam ${totalCount} barkod bulundu.`);

        let offset = 0;
        let totalProcessed = 0;

        while (offset < totalCount) {
            const batchStartTime = Date.now();

            const batch = await mssqlService.query(`
                SELECT bar_stokkodu, bar_kodu, bar_iptal, bar_barkodtipi
                FROM BARKOD_TANIMLARI
                WHERE bar_kodu IS NOT NULL AND bar_kodu != ''
                ORDER BY bar_kodu
                OFFSET ${offset} ROWS
                FETCH NEXT ${BATCH_SIZE} ROWS ONLY
            `);

            if (batch.length === 0) break;

            // Stok ID'lerini toplu çek
            const stokKodlari = [...new Set(batch.map(b => b.bar_stokkodu))];
            const stoklar = await pgService.query(
                `SELECT id, stok_kodu FROM stoklar WHERE stok_kodu = ANY($1)`,
                [stokKodlari]
            );
            const stokMap = new Map(stoklar.map(s => [s.stok_kodu, s.id]));

            const barkodRows = [];
            batch.forEach(erpBarkod => {
                const stokId = stokMap.get(erpBarkod.bar_stokkodu);
                if (!stokId) return;

                const barkodTipler = { '1': 'ana', '2': 'koli', '3': 'palet' };
                const barkodTipi = barkodTipler[erpBarkod.bar_barkodtipi] || 'ana';

                barkodRows.push({
                    stok_id: stokId,
                    barkod: erpBarkod.bar_kodu,
                    barkod_tipi: barkodTipi,
                    aktif: erpBarkod.bar_iptal === 0,
                    guncelleme_tarihi: new Date()
                });
            });

            if (barkodRows.length > 0) {
                const { query, values } = buildBulkUpsertQuery(
                    'urun_barkodlari',
                    ['stok_id', 'barkod', 'barkod_tipi', 'aktif', 'guncelleme_tarihi'],
                    barkodRows,
                    'barkod',
                    ['stok_id', 'barkod_tipi', 'aktif', 'guncelleme_tarihi'],
                    null
                );
                await pgService.query(query, values);
            }

        }

        console.log(`✓ ${totalProcessed} barkod senkronizasyon adımı bitti.`);

        // EK: Kuyruk Temizleme
        // Bulk sync sırasında tetikleyiciler (triggers) tarafından oluşturulan gereksiz Web -> ERP kayıtlarını temizle
        const cleanRes = await pgService.query(`
            DELETE FROM sync_queue 
            WHERE entity_type = 'urun_barkodlari' 
            AND status = 'pending'
        `);
        if (cleanRes) console.log(`  (Bilgi: ${totalProcessed} barkod için oluşan gereksiz senkronizasyon kuyruğu temizlendi)`);

        console.log();

    } catch (error) {
        console.error('Barkod senkronizasyon hatası:', error.message);
        throw error;
    }
}

async function bulkSyncFiyatlar() {
    console.log('='.repeat(70));
    console.log('5. FİYAT SENKRONIZASYONU (ULTRA HIZLI MOD)');
    console.log('='.repeat(70));

    try {
        const fiyatTanimlari = await pgService.query('SELECT id, sira_no FROM fiyat_tanimlari');
        const fiyatTanimMap = new Map(fiyatTanimlari.map(ft => [ft.sira_no, ft.id]));
        console.log(`${fiyatTanimMap.size} fiyat tanımı yüklendi.`);

        const countResult = await mssqlService.query('SELECT COUNT(*) as count FROM STOK_SATIS_FIYAT_LISTELERI WHERE sfiyat_fiyati > 0');
        const totalCount = countResult[0].count;
        console.log(`Toplam ${totalCount} fiyat bulundu.`);

        let offset = 0;
        let totalProcessed = 0;

        while (offset < totalCount) {
            const batchStartTime = Date.now();

            const batch = await mssqlService.query(`
                SELECT sfiyat_stokkod, sfiyat_listesirano, sfiyat_fiyati
                FROM STOK_SATIS_FIYAT_LISTELERI
                WHERE sfiyat_fiyati > 0
                ORDER BY sfiyat_stokkod
                OFFSET ${offset} ROWS
                FETCH NEXT ${BATCH_SIZE} ROWS ONLY
            `);

            if (batch.length === 0) break;

            const stokKodlari = [...new Set(batch.map(f => f.sfiyat_stokkod))];
            const stoklar = await pgService.query(
                `SELECT id, stok_kodu FROM stoklar WHERE stok_kodu = ANY($1)`,
                [stokKodlari]
            );
            const stokMap = new Map(stoklar.map(s => [s.stok_kodu, s.id]));

            const fiyatRows = [];
            const satisFiyatiUpdates = []; // Liste 1 için stoklar tablosunu güncelleyeceğiz

            batch.forEach(erpFiyat => {
                const stokId = stokMap.get(erpFiyat.sfiyat_stokkod);
                if (!stokId) return;

                const fiyatTanimiId = fiyatTanimMap.get(erpFiyat.sfiyat_listesirano);
                if (!fiyatTanimiId) return;

                fiyatRows.push({
                    stok_id: stokId,
                    fiyat_tanimi_id: fiyatTanimiId,
                    fiyat: erpFiyat.sfiyat_fiyati,
                    guncelleme_tarihi: new Date()
                });

                // Liste 1 ise stoklar tablosundaki satis_fiyati'nı güncelle
                if (erpFiyat.sfiyat_listesirano === 1) {
                    satisFiyatiUpdates.push({
                        stok_id: stokId,
                        satis_fiyati: erpFiyat.sfiyat_fiyati
                    });
                }
            });

            if (fiyatRows.length > 0) {
                const { query, values } = buildBulkUpsertQuery(
                    'urun_fiyat_listeleri',
                    ['stok_id', 'fiyat_tanimi_id', 'fiyat', 'guncelleme_tarihi'],
                    fiyatRows,
                    'stok_id, fiyat_tanimi_id',
                    ['fiyat', 'guncelleme_tarihi'],
                    null
                );
                await pgService.query(query, values);
            }

            // Stoklar tablosunda satis_fiyati güncelle (Liste 1)
            if (satisFiyatiUpdates.length > 0) {
                const placeholders = [];
                const values = [];
                let idx = 1;

                satisFiyatiUpdates.forEach(u => {
                    values.push(u.stok_id, u.satis_fiyati);
                    placeholders.push(`($${idx++}, $${idx++})`);
                });

                const updateQuery = `
                    UPDATE stoklar AS s
                    SET satis_fiyati = v.satis_fiyati::numeric,
                        guncelleme_tarihi = NOW()
                    FROM (VALUES ${placeholders.join(', ')}) AS v(id, satis_fiyati)
                    WHERE s.id = v.id::uuid
                `;
                await pgService.query(updateQuery, values);
            }

            totalProcessed += batch.length;
            offset += BATCH_SIZE;
            const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
            console.log(`  Batch tamamlandı: ${totalProcessed}/${totalCount} fiyat (${batch.length} kayıt, ${batchDuration}sn)`);
        }

        console.log(`✓ ${totalProcessed} fiyat senkronize edildi.`);
        console.log();

    } catch (error) {
        console.error('Fiyat senkronizasyon hatası:', error.message);
        throw error;
    }
}

async function main() {
    const startTime = Date.now();

    try {
        console.log('='.repeat(70));
        console.log('HIZLI TOPLU ERP → WEB SENKRONIZASYONU (ULTRA FAST)');
        console.log(`Batch Boyutu: ${BATCH_SIZE}`);
        console.log('='.repeat(70));
        console.log();

        // 0. Pazaryeri Fatura Sıra No Senkronizasyonu
        await invoiceSettingsService.syncInvoiceNumbers();
        console.log();

        // 0. Silinen Kayıtlar (En başta çalışmalı)
        const syncDeletedRecords = require('./sync-deleted-from-erp');
        await syncDeletedRecords();
        console.log();

        // 1. Temel Veriler
        await bulkSyncCategories();
        await bulkSyncStoklar();
        // await bulkSyncBarkodlar();

        // 1.5. Fiyat Tanımları (Fiyatlardan önce olmalı)
        console.log('='.repeat(70));
        console.log('4. FİYAT TANIMLARI SENKRONIZASYONU');
        console.log('='.repeat(70));
        const fiyatTanimProcessor = require('../sync-jobs/fiyat-tanim.processor');
        const fiyatTanimCount = await fiyatTanimProcessor.syncToWeb(null);
        console.log(`✓ ${fiyatTanimCount} fiyat tanımı senkronize edildi.`);
        console.log();

        await bulkSyncFiyatlar();

        // 2. Bağımsız Tanımlar - PARALEL ÇALIŞTIR (Kasa, Banka, Depo)
        console.log('='.repeat(70));
        console.log('6-8. KASA + BANKA + DEPO SENKRONIZASYONU (PARALEL)');
        console.log('='.repeat(70));

        const kasaProcessor = require('../sync-jobs/kasa.processor');
        const bankaProcessor = require('../sync-jobs/banka.processor');
        const depoProcessor = require('../sync-jobs/depo.processor');

        const [kasaCount, bankaCount, depoCount] = await Promise.all([
            kasaProcessor.syncToWeb(null),
            bankaProcessor.syncToWeb(null),
            depoProcessor.syncToWeb(null)
        ]);
        console.log(`✓ ${kasaCount} kasa, ${bankaCount} banka, ${depoCount} depo senkronize edildi.`);
        console.log();

        // 3. Cari Hesaplar (Hareketlerden önce olmalı)
        console.log('='.repeat(70));
        console.log('9. CARİ HESAPLAR SENKRONIZASYONU');
        console.log('='.repeat(70));
        const cariProcessor = require('../sync-jobs/cari.processor');
        const cariCount = await cariProcessor.syncToWeb(null);
        console.log(`✓ ${cariCount} cari hesap senkronize edildi.`);
        console.log();

        // 4. Hareketler - PARALEL ÇALIŞTIR
        console.log('='.repeat(70));
        console.log('10-11. STOK + CARİ HAREKETLERİ SENKRONIZASYONU (PARALEL)');
        console.log('='.repeat(70));

        const stokHareketProcessor = require('../sync-jobs/stok-hareket.processor');
        const cariHareketProcessor = require('../sync-jobs/cari-hareket.processor');

        const [stokHareketCount, cariHareketCount] = await Promise.all([
            stokHareketProcessor.syncToWeb(null),
            cariHareketProcessor.syncToWeb(null)
        ]);
        console.log(`✓ ${stokHareketCount} stok hareketi, ${cariHareketCount} cari hareket senkronize edildi.`);
        console.log();

        // 12. Entegra SQLITE Senkronizasyonu
        // Not: runEntegraSync kendi bağlantılarını yönetir ve kapatır
        await runEntegraSync({ disconnect: false });

        // 13. Stok XML Oluşturma ve Yükleme (EN SON)
        console.log('='.repeat(70));
        console.log('13. STOK XML OLUŞTURMA VE YÜKLEME');
        console.log('='.repeat(70));
        const xmlGenerated = await stockXmlService.generateXML();
        if (xmlGenerated) {
            await stockXmlService.uploadToSSH();
        }
        console.log();

        // NOT: Satış ve Tahsilat processor'ları Web->ERP yönünde çalışıyor
        // ERP->Web senkronizasyonu için ayrı processor'lar gerekiyor

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('='.repeat(70));
        console.log('✓ TÜM SENKRONIZASYON TAMAMLANDI!');
        console.log(`Toplam Süre: ${duration} saniye`);
        console.log('='.repeat(70));

    } catch (error) {
        console.error();
        console.error('='.repeat(70));
        console.error('✗ SENKRONIZASYON BAŞARISIZ!');
        console.error('='.repeat(70));
        console.error('Hata:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
        process.exit(0);
    }
}

main();
