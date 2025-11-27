require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function syncCategories() {
    try {
        console.log('Kategori Senkronizasyonu Başlıyor...');

        // 1. Veritabanı Bağlantıları
        // pgService.query otomatik bağlanır
        // mssqlService.query otomatik bağlanır

        // 2. Tablo Yapısını Güncelle (Eğer yoksa)
        console.log('Tablo yapısı kontrol ediliyor...');
        try {
            await pgService.query(`
                ALTER TABLE kategoriler 
                ADD COLUMN IF NOT EXISTS is_erp_category boolean DEFAULT false,
                ADD COLUMN IF NOT EXISTS erp_id text;
            `);

            // Index ekle
            await pgService.query(`
                CREATE INDEX IF NOT EXISTS idx_kategoriler_erp_id ON kategoriler(erp_id);
            `);
            console.log('Tablo yapısı güncellendi/kontrol edildi.');
        } catch (e) {
            console.error('Tablo güncelleme hatası:', e.message);
        }

        // 3. ERP'den Verileri Çek
        console.log('ERP verileri çekiliyor...');
        const anaGruplar = await mssqlService.query('SELECT san_kod, san_isim FROM STOK_ANA_GRUPLARI');
        const altGruplar = await mssqlService.query('SELECT sta_kod, sta_isim, sta_ana_grup_kod FROM STOK_ALT_GRUPLARI');

        console.log(`${anaGruplar.length} ana grup ve ${altGruplar.length} alt grup bulundu.`);

        // 4. Ana Grupları Senkronize Et
        console.log('Ana gruplar işleniyor...');
        const anaGrupMap = new Map(); // san_kod -> web_id

        for (const grup of anaGruplar) {
            const { san_kod, san_isim } = grup;

            // Mevcut kaydı kontrol et
            const existing = await pgService.query('SELECT id FROM kategoriler WHERE erp_id = $1', [san_kod]);

            let webId;
            if (existing.length > 0) {
                // Güncelle
                webId = existing[0].id;
                await pgService.query(
                    `UPDATE kategoriler SET 
                        kategori_adi = $1, 
                        guncelleme_tarihi = NOW(),
                        is_erp_category = true,
                        path = ARRAY[$2::text]
                     WHERE id = $2`,
                    [san_isim, webId]
                );
            } else {
                // Ekle
                const result = await pgService.query(
                    `INSERT INTO kategoriler (kategori_adi, is_erp_category, erp_id, level, parent_id) 
                     VALUES ($1, true, $2, 0, NULL) RETURNING id`,
                    [san_isim, san_kod]
                );
                webId = result[0].id;

                // Path güncelle
                await pgService.query(
                    `UPDATE kategoriler SET path = ARRAY[$1::text] WHERE id = $1`,
                    [webId]
                );
            }
            anaGrupMap.set(san_kod, webId);
        }

        // 5. Alt Grupları Senkronize Et
        console.log('Alt gruplar işleniyor...');
        for (const grup of altGruplar) {
            const { sta_kod, sta_isim, sta_ana_grup_kod } = grup;

            const parentId = anaGrupMap.get(sta_ana_grup_kod);
            if (!parentId) {
                console.warn(`Alt grup ${sta_kod} (${sta_isim}) için ana grup ${sta_ana_grup_kod} bulunamadı, atlanıyor.`);
                continue;
            }

            // Mevcut kaydı kontrol et
            const existing = await pgService.query('SELECT id FROM kategoriler WHERE erp_id = $1', [sta_kod]);

            if (existing.length > 0) {
                // Güncelle
                const webId = existing[0].id;
                await pgService.query(
                    `UPDATE kategoriler SET 
                        kategori_adi = $1, 
                        parent_id = $2,
                        guncelleme_tarihi = NOW(),
                        is_erp_category = true,
                        level = 1,
                        path = ARRAY[$2::text, $3::text]
                     WHERE id = $3`,
                    [sta_isim, parentId, webId]
                );
            } else {
                // Ekle
                const result = await pgService.query(
                    `INSERT INTO kategoriler (kategori_adi, is_erp_category, erp_id, level, parent_id) 
                     VALUES ($1, true, $2, 1, $3) RETURNING id`,
                    [sta_isim, sta_kod, parentId]
                );
                const webId = result[0].id;

                // Path güncelle
                await pgService.query(
                    `UPDATE kategoriler SET path = ARRAY[$1::text, $2::text] WHERE id = $2`,
                    [parentId, webId]
                );
            }
        }

        console.log('Senkronizasyon başarıyla tamamlandı.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

syncCategories();
