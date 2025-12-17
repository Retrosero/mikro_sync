require('dotenv').config();
const pgService = require('./services/postgresql.service');

(async () => {
    try {
        console.log('Alış tabloları sıfırlanıyor ve yeniden kuruluyor...');

        await pgService.query('DROP TABLE IF EXISTS alis_kalemleri CASCADE');
        await pgService.query('DROP TABLE IF EXISTS alislar CASCADE');
        // int_alis_mapping tablosunu koruyalım mı? Test için silelim temiz olsun.
        await pgService.query('DROP TABLE IF EXISTS int_alis_mapping CASCADE');

        // 1. alislar tablosu
        await pgService.query(`
            CREATE TABLE IF NOT EXISTS alislar (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cari_hesap_id UUID NOT NULL references cari_hesaplar(id),
                alis_tarihi TIMESTAMP DEFAULT NOW(),
                fatura_seri_no VARCHAR(5),
                belge_no VARCHAR(20),
                fatura_tipi VARCHAR(20) DEFAULT 'alis', -- alis, iade
                toplam_tutar NUMERIC(10,2) DEFAULT 0,
                ara_toplam NUMERIC(10,2) DEFAULT 0,
                indirim_tutari NUMERIC(10,2) DEFAULT 0,
                kdv_tutari NUMERIC(10,2) DEFAULT 0,
                odeme_sekli VARCHAR(20) DEFAULT 'acik_hesap', -- acik_hesap, nakit, havale
                kasa_id UUID, -- references kasalar(id)
                kasa_kodu VARCHAR(20),
                banka_id UUID, -- references bankalar(id)
                banka_kodu VARCHAR(20),
                aciklama VARCHAR(100),
                iade BOOLEAN DEFAULT FALSE,
                
                -- İskontolar
                iskonto1 NUMERIC(10,2) DEFAULT 0,
                iskonto2 NUMERIC(10,2) DEFAULT 0,
                iskonto3 NUMERIC(10,2) DEFAULT 0,
                iskonto4 NUMERIC(10,2) DEFAULT 0,
                iskonto5 NUMERIC(10,2) DEFAULT 0,
                iskonto6 NUMERIC(10,2) DEFAULT 0,
                
                indirim_tutari2 NUMERIC(10,2) DEFAULT 0,
                indirim_tutari3 NUMERIC(10,2) DEFAULT 0,
                indirim_tutari4 NUMERIC(10,2) DEFAULT 0,
                indirim_tutari5 NUMERIC(10,2) DEFAULT 0,
                indirim_tutari6 NUMERIC(10,2) DEFAULT 0,

                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('alislar tablosu hazır.');

        // 2. alis_kalemleri tablosu
        await pgService.query(`
            CREATE TABLE IF NOT EXISTS alis_kalemleri (
                id SERIAL PRIMARY KEY,
                alis_id UUID NOT NULL references alislar(id) ON DELETE CASCADE,
                stok_id UUID, -- references stoklar(id) - assuming UUID from stoklar
                sira_no INTEGER DEFAULT 0,
                miktar NUMERIC(10,2) DEFAULT 0,
                birim_fiyat NUMERIC(10,2) DEFAULT 0,
                toplam_tutar NUMERIC(10,2) DEFAULT 0,
                kdv_orani INTEGER DEFAULT 18,
                kdv_tutari NUMERIC(10,2) DEFAULT 0,
                indirim_tutari NUMERIC(10,2) DEFAULT 0,

                -- İskontolar (Satır bazlı)
                iskonto1 NUMERIC(10,2) DEFAULT 0,
                iskonto2 NUMERIC(10,2) DEFAULT 0,
                iskonto3 NUMERIC(10,2) DEFAULT 0,
                iskonto4 NUMERIC(10,2) DEFAULT 0,
                iskonto5 NUMERIC(10,2) DEFAULT 0,
                iskonto6 NUMERIC(10,2) DEFAULT 0,

                indirim_tutari2 NUMERIC(10,2) DEFAULT 0,
                indirim_tutari3 NUMERIC(10,2) DEFAULT 0,
                indirim_tutari4 NUMERIC(10,2) DEFAULT 0,
                indirim_tutari5 NUMERIC(10,2) DEFAULT 0,
                indirim_tutari6 NUMERIC(10,2) DEFAULT 0,

                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('alis_kalemleri tablosu hazır.');

        // 3. int_alis_mapping tablosu
        await pgService.query(`
            CREATE TABLE IF NOT EXISTS int_alis_mapping (
                web_alis_id UUID PRIMARY KEY,
                erp_evrak_seri VARCHAR(5),
                erp_evrak_no INTEGER,
                sync_date TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('int_alis_mapping tablosu hazır.');

        console.log('Tüm tablolar başarıyla oluşturuldu/kontrol edildi.');

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        await pgService.disconnect();
    }
})();
