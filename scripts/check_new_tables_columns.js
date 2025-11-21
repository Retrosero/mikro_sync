const mssqlService = require('../services/mssql.service');

async function checkColumns() {
    try {
        const tables = ['CARI_HESAPLAR', 'CARI_HESAP_HAREKETLERI', 'STOK_HAREKETLERI', 'BARKOD_TANIMLARI'];

        for (const table of tables) {
            console.log(`\n═══════════════════════════════════════════════════════`);
            console.log(`  🔍 ${table} KOLONLARI`);
            console.log(`═══════════════════════════════════════════════════════`);

            const result = await mssqlService.query(`SELECT TOP 1 * FROM ${table}`);

            if (result.length > 0) {
                Object.keys(result[0]).forEach(col => {
                    // Sadece ilgilendiğimiz kolonları veya hepsini yazdıralım
                    console.log(`  - ${col}`);
                });
            } else {
                console.log('  ⚠️  Veri bulunamadı');
            }
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkColumns();
