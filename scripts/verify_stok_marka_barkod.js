require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function verifyStokMarkaBarkod() {
    try {
        // Toplam stok sayısı
        const totalStok = await pgService.query("SELECT COUNT(*) as count FROM stoklar");
        console.log('Total Stok:', totalStok[0].count);

        // Marka ID'si dolu olan stok sayısı
        const stokWithMarka = await pgService.query("SELECT COUNT(*) as count FROM stoklar WHERE marka_id IS NOT NULL");
        console.log('Stok with Marka ID:', stokWithMarka[0].count);

        // Barkodu dolu olan stok sayısı
        const stokWithBarkod = await pgService.query("SELECT COUNT(*) as count FROM stoklar WHERE barkod IS NOT NULL");
        console.log('Stok with Barkod:', stokWithBarkod[0].count);

        // Örnek kayıtlar
        const samples = await pgService.query(`
            SELECT s.stok_kodu, s.stok_adi, m.marka_adi, s.barkod 
            FROM stoklar s
            LEFT JOIN markalar m ON s.marka_id = m.id
            WHERE s.marka_id IS NOT NULL AND s.barkod IS NOT NULL
            LIMIT 5
        `);
        console.log('Sample Records:', samples);

    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}

verifyStokMarkaBarkod();
