require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function addErpColumns() {
    try {
        console.log('cari_hesap_hareketleri tablosuna ERP kolonları ekleniyor...\n');

        // cha_tpoz kolonu ekle
        await pgService.query(`
            ALTER TABLE cari_hesap_hareketleri 
            ADD COLUMN IF NOT EXISTS cha_tpoz INTEGER DEFAULT 0
        `);
        console.log('✓ cha_tpoz kolonu eklendi');

        // cha_cari_cins kolonu ekle
        await pgService.query(`
            ALTER TABLE cari_hesap_hareketleri 
            ADD COLUMN IF NOT EXISTS cha_cari_cins INTEGER DEFAULT 0
        `);
        console.log('✓ cha_cari_cins kolonu eklendi');

        // cha_grupno kolonu ekle
        await pgService.query(`
            ALTER TABLE cari_hesap_hareketleri 
            ADD COLUMN IF NOT EXISTS cha_grupno INTEGER DEFAULT 0
        `);
        console.log('✓ cha_grupno kolonu eklendi');

        // Index'ler ekle (performans için)
        await pgService.query(`
            CREATE INDEX IF NOT EXISTS idx_cari_hesap_hareketleri_cha_tpoz 
            ON cari_hesap_hareketleri(cha_tpoz)
        `);
        console.log('✓ cha_tpoz index oluşturuldu');

        await pgService.query(`
            CREATE INDEX IF NOT EXISTS idx_cari_hesap_hareketleri_cha_cari_cins 
            ON cari_hesap_hareketleri(cha_cari_cins)
        `);
        console.log('✓ cha_cari_cins index oluşturuldu');

        console.log('\n✓ Tüm kolonlar başarıyla eklendi!');

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

addErpColumns();
