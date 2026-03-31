/**
 * Stok ve Cari hareket tablolarına UNIQUE constraint ekler
 * 
 * Sorun: ON CONFLICT (erp_recno) kullanılırken unique constraint yoktu
 * Çözüm: erp_recno kolonlarına UNIQUE constraint ekle
 */

const { Pool } = require('pg');
const config = require('./config/postgresql.config');

const pool = new Pool(config);

async function addUniqueConstraints() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. stok_hareketleri tablosu için UNIQUE constraint
        console.log('stok_hareketleri: erp_recno unique constraint ekleniyor...');

        // Önce duplicate kayıtları kontrol et
        const duplicateCheckStok = await client.query(`
            SELECT erp_recno, COUNT(*) as count
            FROM stok_hareketleri
            WHERE erp_recno IS NOT NULL
            GROUP BY erp_recno
            HAVING COUNT(*) > 1
        `);

        if (duplicateCheckStok.rows.length > 0) {
            console.warn('UYARI: stok_hareketleri tablosunda duplicate erp_recno değerleri bulundu:');
            duplicateCheckStok.rows.forEach(row => {
                console.warn(`  erp_recno: ${row.erp_recno}, count: ${row.count}`);
            });
            console.log('Duplicate kayıtlar temizleniyor (en yüksek ID\'li olanı tutarak)...');

            // Her duplicate grup için en yüksek ID'li kaydı tut, diğerlerini sil
            for (const dup of duplicateCheckStok.rows) {
                const deleteResult = await client.query(`
                    DELETE FROM stok_hareketleri
                    WHERE erp_recno = $1
                    AND id NOT IN (
                        SELECT id FROM stok_hareketleri
                        WHERE erp_recno = $1
                        ORDER BY id DESC
                        LIMIT 1
                    )
                `, [dup.erp_recno]);
                console.log(`  erp_recno ${dup.erp_recno} için ${deleteResult.rowCount} kayıt silindi`);
            }
        }

        // Unique constraint ekle (varsa önce düşür)
        try {
            await client.query(`
                ALTER TABLE stok_hareketleri 
                DROP CONSTRAINT IF EXISTS stok_hareketleri_erp_recno_unique
            `);
            console.log('Eski unique constraint (varsa) düşürüldü');
        } catch (e) {
            console.log('stok_hareketleri: Önceki unique constraint bulunamadı, devam ediliyor...');
        }

        await client.query(`
            ALTER TABLE stok_hareketleri 
            ADD CONSTRAINT stok_hareketleri_erp_recno_unique 
            UNIQUE (erp_recno)
        `);
        console.log('✓ stok_hareketleri: erp_recno unique constraint eklendi');

        // 2. cari_hesap_hareketleri tablosu için UNIQUE constraint
        console.log('\ncari_hesap_hareketleri: erp_recno unique constraint ekleniyor...');

        // Önce duplicate kayıtları kontrol et
        const duplicateCheckCari = await client.query(`
            SELECT erp_recno, COUNT(*) as count
            FROM cari_hesap_hareketleri
            WHERE erp_recno IS NOT NULL
            GROUP BY erp_recno
            HAVING COUNT(*) > 1
        `);

        if (duplicateCheckCari.rows.length > 0) {
            console.warn('UYARI: cari_hesap_hareketleri tablosunda duplicate erp_recno değerleri bulundu:');
            duplicateCheckCari.rows.forEach(row => {
                console.warn(`  erp_recno: ${row.erp_recno}, count: ${row.count}`);
            });
            console.log('Duplicate kayıtlar temizleniyor (en yüksek ID\'li olanı tutarak)...');

            // Her duplicate grup için en yüksek ID'li kaydı tut, diğerlerini sil
            for (const dup of duplicateCheckCari.rows) {
                const deleteResult = await client.query(`
                    DELETE FROM cari_hesap_hareketleri
                    WHERE erp_recno = $1
                    AND id NOT IN (
                        SELECT id FROM cari_hesap_hareketleri
                        WHERE erp_recno = $1
                        ORDER BY id DESC
                        LIMIT 1
                    )
                `, [dup.erp_recno]);
                console.log(`  erp_recno ${dup.erp_recno} için ${deleteResult.rowCount} kayıt silindi`);
            }
        }

        // Unique constraint ekle (varsa önce düşür)
        try {
            await client.query(`
                ALTER TABLE cari_hesap_hareketleri 
                DROP CONSTRAINT IF EXISTS cari_hesap_hareketleri_erp_recno_unique
            `);
            console.log('Eski unique constraint (varsa) düşürüldü');
        } catch (e) {
            console.log('cari_hesap_hareketleri: Önceki unique constraint bulunamadı, devam ediliyor...');
        }

        await client.query(`
            ALTER TABLE cari_hesap_hareketleri 
            ADD CONSTRAINT cari_hesap_hareketleri_erp_recno_unique 
            UNIQUE (erp_recno)
        `);
        console.log('✓ cari_hesap_hareketleri: erp_recno unique constraint eklendi');

        await client.query('COMMIT');
        console.log('\n✓ Tüm unique constraint\'ler başarıyla eklendi!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('HATA:', error.message);
        console.error('İşlem geri alındı (ROLLBACK)');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Çalıştır
if (require.main === module) {
    addUniqueConstraints()
        .then(() => {
            console.log('İşlem tamamlandı.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('İşlem başarısız:', err);
            process.exit(1);
        });
}

module.exports = { addUniqueConstraints };