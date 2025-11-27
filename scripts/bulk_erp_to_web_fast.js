require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

const BATCH_SIZE = 4000;

async function bulkSyncCategories() {
    console.log('='.repeat(70));
    console.log('1. KATEGORİ SENKRONIZASYONU');
    console.log('='.repeat(70));

    try {
        // Ana grupları çek
        const anaGruplar = await mssqlService.query('SELECT san_kod, san_isim FROM STOK_ANA_GRUPLARI');
        console.log(`${anaGruplar.length} ana grup bulundu.`);

        const anaGrupMap = new Map();

        for (const grup of anaGruplar) {
            const { san_kod, san_isim } = grup;

            try {
                const existing = await pgService.query('SELECT id FROM kategoriler WHERE erp_id = $1', [san_kod]);

                let webId;
                if (existing.length > 0) {
                    webId = existing[0].id;
                    await pgService.query(
                        `UPDATE kategoriler SET 
                            kategori_adi = $1, 
                            guncelleme_tarihi = NOW(),
                            is_erp_category = true
                         WHERE id = $2`,
                        [san_isim, webId]
                    );
                } else {
                    const result = await pgService.query(
                        `INSERT INTO kategoriler (kategori_adi, is_erp_category, erp_id, level, parent_id) 
                         VALUES ($1, true, $2, 0, NULL) RETURNING id`,
                        [san_isim, san_kod]
                    );
                    webId = result[0].id;
                }
                anaGrupMap.set(san_kod, webId);
            } catch (err) {
                console.error(`Ana grup hatası (${san_kod}):`, err.message);
            }
        }

        console.log(`✓ ${anaGrupMap.size} ana grup senkronize edildi.`);

        // Alt grupları çek
        const altGruplar = await mssqlService.query('SELECT sta_kod, sta_isim, sta_ana_grup_kod FROM STOK_ALT_GRUPLARI');
        console.log(`${altGruplar.length} alt grup bulundu.`);

        let processedAlt = 0;
        for (const grup of altGruplar) {
            const { sta_kod, sta_isim, sta_ana_grup_kod } = grup;

            const parentId = anaGrupMap.get(sta_ana_grup_kod);
            if (!parentId) {
                continue;
            }

            try {
                const existing = await pgService.query('SELECT id FROM kategoriler WHERE erp_id = $1', [sta_kod]);

                if (existing.length > 0) {
                    const webId = existing[0].id;
                    await pgService.query(
                        `UPDATE kategoriler SET 
                            kategori_adi = $1, 
                            parent_id = $2,
                            guncelleme_tarihi = NOW(),
                            is_erp_category = true,
                            level = 1
                         WHERE id = $3`,
                        [sta_isim, parentId, webId]
                    );
                } else {
                    await pgService.query(
                        `INSERT INTO kategoriler (kategori_adi, is_erp_category, erp_id, level, parent_id) 
                         VALUES ($1, true, $2, 1, $3)`,
                        [sta_isim, sta_kod, parentId]
                    );
                }
                processedAlt++;
            } catch (err) {
                console.error(`Alt grup hatası (${sta_kod}):`, err.message);
            }
        }

        console.log(`✓ ${processedAlt} alt grup senkronize edildi.`);
        console.log();

    } catch (error) {
        console.error('Kategori senkronizasyon hatası:', error.message);
        throw error;
    }
}

async function bulkSyncStoklar() {
    console.log('='.repeat(70));
    console.log('2. STOK SENKRONIZASYONU (HIZLI MOD)');
    console.log('='.repeat(70));

    try {
        // Kategorileri belleğe yükle
        const categories = await pgService.query('SELECT id, erp_id FROM kategoriler WHERE erp_id IS NOT NULL');
        const categoryMap = new Map();
        for (const cat of categories) {
            const erpId = cat.erp_id ? cat.erp_id.trim() : null;
            if (erpId) {
                categoryMap.set(erpId, cat.id);
            }
        }
        console.log(`${categoryMap.size} kategori eşleşmesi yüklendi.`);

        // Toplam stok sayısını al
        const countResult = await mssqlService.query('SELECT COUNT(*) as count FROM STOKLAR WHERE sto_pasif_fl = 0');
        const totalCount = countResult[0].count;
        console.log(`Toplam ${totalCount} aktif stok bulundu.`);

        let offset = 0;
        let totalProcessed = 0;

        while (offset < totalCount) {
            console.log(`Batch işleniyor: ${offset}-${offset + BATCH_SIZE}...`);

            const batch = await mssqlService.query(`
                SELECT 
                    sto_kod, sto_isim, sto_birim1_ad, sto_standartmaliyet,
                    sto_sektor_kodu, sto_reyon_kodu, sto_ambalaj_kodu, 
                    sto_kalkon_kodu,
                    sto_altgrup_kod, sto_anagrup_kod
                FROM STOKLAR
                WHERE sto_pasif_fl = 0
                ORDER BY sto_kod
                OFFSET ${offset} ROWS
                FETCH NEXT ${BATCH_SIZE} ROWS ONLY
            `);

            // Batch içindeki tüm stok kodlarını topla
            const stokKodlari = batch.map(s => s.sto_kod);

            // Mevcut stokları tek sorguda çek
            const mevcutStoklar = await pgService.query(
                `SELECT id, stok_kodu FROM stoklar WHERE stok_kodu = ANY($1)`,
                [stokKodlari]
            );

            const mevcutStokMap = new Map();
            for (const s of mevcutStoklar) {
                mevcutStokMap.set(s.stok_kodu, s.id);
            }

            // Her stok için işlem yap
            for (const erpStok of batch) {
                try {
                    // Kategori ID belirle
                    let kategoriId = null;
                    const altGrupKod = erpStok.sto_altgrup_kod ? erpStok.sto_altgrup_kod.trim() : null;
                    const anaGrupKod = erpStok.sto_anagrup_kod ? erpStok.sto_anagrup_kod.trim() : null;

                    if (altGrupKod && categoryMap.has(altGrupKod)) {
                        kategoriId = categoryMap.get(altGrupKod);
                    } else if (anaGrupKod && categoryMap.has(anaGrupKod)) {
                        kategoriId = categoryMap.get(anaGrupKod);
                    }

                    let koliadeti = 0;
                    if (erpStok.sto_kalkon_kodu) {
                        const parsed = parseInt(erpStok.sto_kalkon_kodu);
                        koliadeti = isNaN(parsed) ? 0 : parsed;
                    }

                    const webStokId = mevcutStokMap.get(erpStok.sto_kod);

                    if (webStokId) {
                        // Güncelle
                        await pgService.query(
                            `UPDATE stoklar SET 
                              stok_adi = $1, 
                              birim_turu = $2, 
                              alis_fiyati = $3, 
                              olcu = $4, 
                              raf_kodu = $5, 
                              ambalaj = $6, 
                              koliadeti = $7, 
                              kategori_id = $8, 
                              guncelleme_tarihi = NOW()
                             WHERE id = $9`,
                            [
                                erpStok.sto_isim,
                                erpStok.sto_birim1_ad || 'Adet',
                                erpStok.sto_standartmaliyet || 0,
                                erpStok.sto_sektor_kodu || '',
                                erpStok.sto_reyon_kodu || '',
                                erpStok.sto_ambalaj_kodu || '',
                                koliadeti,
                                kategoriId,
                                webStokId
                            ]
                        );

                        // Mapping güncelle
                        await pgService.query(
                            `INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod) 
                             VALUES ($1, $2) 
                             ON CONFLICT (erp_stok_kod) DO UPDATE SET web_stok_id = EXCLUDED.web_stok_id`,
                            [webStokId, erpStok.sto_kod]
                        );
                    } else {
                        // Ekle
                        const result = await pgService.queryOne(
                            `INSERT INTO stoklar (
                              stok_kodu, stok_adi, birim_turu, alis_fiyati, satis_fiyati,
                              aciklama, olcu, raf_kodu, ambalaj, koliadeti, aktif, kategori_id
                            ) VALUES ($1, $2, $3, $4, 0, '', $5, $6, $7, $8, true, $9)
                            RETURNING id`,
                            [
                                erpStok.sto_kod,
                                erpStok.sto_isim,
                                erpStok.sto_birim1_ad || 'Adet',
                                erpStok.sto_standartmaliyet || 0,
                                erpStok.sto_sektor_kodu || '',
                                erpStok.sto_reyon_kodu || '',
                                erpStok.sto_ambalaj_kodu || '',
                                koliadeti,
                                kategoriId
                            ]
                        );

                        // Mapping ekle
                        await pgService.query(
                            'INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod) VALUES ($1, $2)',
                            [result.id, erpStok.sto_kod]
                        );
                    }

                    totalProcessed++;
                } catch (error) {
                    console.error(`Stok hatası (${erpStok.sto_kod}):`, error.message);
                }
            }

            offset += BATCH_SIZE;
            console.log(`  ${totalProcessed}/${totalCount} stok işlendi.`);
        }

        console.log(`✓ ${totalProcessed} stok senkronize edildi.`);
        console.log();

    } catch (error) {
        console.error('Stok senkronizasyon hatası:', error.message);
        throw error;
    }
}

async function bulkSyncBarkodlar() {
    console.log('='.repeat(70));
    console.log('3. BARKOD SENKRONIZASYONU (HIZLI MOD)');
    console.log('='.repeat(70));

    try {
        const countResult = await mssqlService.query('SELECT COUNT(*) as count FROM BARKOD_TANIMLARI');
        const totalCount = countResult[0].count;
        console.log(`Toplam ${totalCount} barkod bulundu.`);

        let offset = 0;
        let totalProcessed = 0;

        while (offset < totalCount) {
            console.log(`Batch işleniyor: ${offset}-${offset + BATCH_SIZE}...`);

            const batch = await mssqlService.query(`
                SELECT bar_stokkodu, bar_kodu, bar_pasif_fl, bar_tipi
                FROM BARKOD_TANIMLARI
                WHERE bar_kodu IS NOT NULL AND bar_kodu != ''
                ORDER BY bar_kodu
                OFFSET ${offset} ROWS
                FETCH NEXT ${BATCH_SIZE} ROWS ONLY
            `);

            // Stok ID'lerini toplu çek
            const stokKodlari = [...new Set(batch.map(b => b.bar_stokkodu))];
            const stoklar = await pgService.query(
                `SELECT id, stok_kodu FROM stoklar WHERE stok_kodu = ANY($1)`,
                [stokKodlari]
            );

            const stokMap = new Map();
            for (const s of stoklar) {
                stokMap.set(s.stok_kodu, s.id);
            }

            for (const erpBarkod of batch) {
                try {
                    const stokId = stokMap.get(erpBarkod.bar_stokkodu);
                    if (!stokId) continue;

                    const barkodTipler = { '1': 'ana', '2': 'koli', '3': 'palet' };
                    const barkodTipi = barkodTipler[erpBarkod.bar_tipi] || 'ana';

                    await pgService.query(`
                        INSERT INTO urun_barkodlari (stok_id, barkod, barkod_tipi, aktif, guncelleme_tarihi)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (barkod) DO UPDATE SET
                            stok_id = EXCLUDED.stok_id,
                            barkod_tipi = EXCLUDED.barkod_tipi,
                            aktif = EXCLUDED.aktif,
                            guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
                    `, [stokId, erpBarkod.bar_kodu, barkodTipi, erpBarkod.bar_pasif_fl === 0]);

                    totalProcessed++;
                } catch (error) {
                    // Sessizce devam et
                }
            }

            offset += BATCH_SIZE;
            console.log(`  ${totalProcessed}/${totalCount} barkod işlendi.`);
        }

        console.log(`✓ ${totalProcessed} barkod senkronize edildi.`);
        console.log();

    } catch (error) {
        console.error('Barkod senkronizasyon hatası:', error.message);
        throw error;
    }
}

async function bulkSyncFiyatlar() {
    console.log('='.repeat(70));
    console.log('4. FİYAT SENKRONIZASYONU (HIZLI MOD)');
    console.log('='.repeat(70));

    try {
        const countResult = await mssqlService.query('SELECT COUNT(*) as count FROM STOK_SATIS_FIYAT_LISTELERI WHERE sfiyat_fiyati > 0');
        const totalCount = countResult[0].count;
        console.log(`Toplam ${totalCount} fiyat bulundu.`);

        let offset = 0;
        let totalProcessed = 0;

        while (offset < totalCount) {
            console.log(`Batch işleniyor: ${offset}-${offset + BATCH_SIZE}...`);

            const batch = await mssqlService.query(`
                SELECT sfiyat_stokkod, sfiyat_listesirano, sfiyat_fiyati, sfiyat_doviz
                FROM STOK_SATIS_FIYAT_LISTELERI
                WHERE sfiyat_fiyati > 0
                ORDER BY sfiyat_stokkod
                OFFSET ${offset} ROWS
                FETCH NEXT ${BATCH_SIZE} ROWS ONLY
            `);

            // Stok ID'lerini toplu çek
            const stokKodlari = [...new Set(batch.map(f => f.sfiyat_stokkod))];
            const stoklar = await pgService.query(
                `SELECT id, stok_kodu FROM stoklar WHERE stok_kodu = ANY($1)`,
                [stokKodlari]
            );

            const stokMap = new Map();
            for (const s of stoklar) {
                stokMap.set(s.stok_kodu, s.id);
            }

            for (const erpFiyat of batch) {
                try {
                    const stokId = stokMap.get(erpFiyat.sfiyat_stokkod);
                    if (!stokId) continue;

                    await pgService.query(`
                        INSERT INTO urun_fiyat_listeleri (stok_id, fiyat_liste_no, fiyat, doviz_kodu, guncelleme_tarihi)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (stok_id, fiyat_liste_no) DO UPDATE SET
                            fiyat = EXCLUDED.fiyat,
                            doviz_kodu = EXCLUDED.doviz_kodu,
                            guncelleme_tarihi = EXCLUDED.guncelleme_tarihi
                    `, [stokId, erpFiyat.sfiyat_listesirano, erpFiyat.sfiyat_fiyati, erpFiyat.sfiyat_doviz || 'TL']);

                    totalProcessed++;
                } catch (error) {
                    // Sessizce devam et
                }
            }

            offset += BATCH_SIZE;
            console.log(`  ${totalProcessed}/${totalCount} fiyat işlendi.`);
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
        console.log('TOPLU ERP → WEB SENKRONIZASYONU (HIZLI MOD)');
        console.log(`Batch Boyutu: ${BATCH_SIZE}`);
        console.log('='.repeat(70));
        console.log();

        await bulkSyncCategories();
        await bulkSyncStoklar();
        await bulkSyncBarkodlar();
        await bulkSyncFiyatlar();

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
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
        process.exit(0);
    }
}

main();
