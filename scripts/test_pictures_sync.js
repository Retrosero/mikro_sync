const { Pool } = require('pg');
const mssqlService = require('../services/mssql.service');
const sqliteService = require('../services/sqlite.service');
const stokProcessor = require('../sync-jobs/stok.processor');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    ssl: false
});

async function runTest() {
    try {
        console.log("MSSQL bağlanıyor...");
        await mssqlService.connect();

        console.log("PostgreSQL'den test verisi alınıyor...");
        const res = await pool.query("SELECT * FROM stoklar WHERE stok_kodu IS NOT NULL LIMIT 1 FOR UPDATE SKIP LOCKED");
        if (res.rows.length === 0) {
            console.log("Test edilecek stok bulunamadı.");
            return;
        }

        // Test amaçlı resim linkleri ekleyelim (biri valid, diğeri invalid denemek için)
        const webStok = res.rows[0];

        // Gerçek bir Gürbüz Oyuncak resmi url'si (resimler dizininde olan bir şey, formatlama test için /images/ ile verelim)
        webStok.resim_url = '/images/cekbirak-metal-araba-chevrolet-camaro-zl1-3611a-turuncu-31607.png';
        // Gerçek sitede varsa iner, yoksa 404
        console.log(`Test edilecek ürün: ${webStok.stok_adi} (${webStok.stok_kodu})`);

        // Doğrudan metodumuzu çağıralım
        console.log("updateEntegraPictures çağrılıyor...");
        await stokProcessor.updateEntegraPictures(webStok);

        console.log("SQLite pictures tablosundan sonuç kontrol ediliyor...");

        sqliteService.connect(true);
        const product = sqliteService.queryOne(
            `SELECT id FROM product WHERE productCode = ?`,
            [webStok.stok_kodu]
        );

        if (product) {
            const pictures = sqliteService.query(
                `SELECT * FROM pictures WHERE product_id = ?`,
                [product.id]
            );
            console.log(`Bulunan resim sayısı: ${pictures.length}`);
            console.log(pictures);

            // Dosya sistemini test et
            const targetPath1 = 'C:\\Ana Entegra\\resimler\\cekbirak-metal-araba-chevrolet-camaro-zl1-3611a-turuncu-31607.png';
            const targetPath2 = 'C:\\Ana Entegra\\resimler2\\cekbirak-metal-araba-chevrolet-camaro-zl1-3611a-turuncu-31607.png';

            console.log("Resimler klasöründe var mı?", fs.existsSync(targetPath1));
            console.log("Resimler2 klasöründe var mı?", fs.existsSync(targetPath2));
        } else {
            console.log("Uyarı: Bu stok koduna ait ürün SQLite tablosunda yok. Resim eklenmedi.");
        }

    } catch (err) {
        console.error("Hata:", err);
    } finally {
        pool.end();
        mssqlService.disconnect();
        try { sqliteService.disconnect(); } catch (e) { }
    }
}

runTest();
