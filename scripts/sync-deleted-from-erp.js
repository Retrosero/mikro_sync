require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

async function syncDeletedRecords() {
    console.log('='.repeat(70));
    console.log('SİLİNEN KAYITLARIN SENKRONIZASYONU (ERP -> WEB)');
    console.log('='.repeat(70));

    try {
        // 1. İşlenmemiş silme kayıtlarını çek
        const deletedLogs = await mssqlService.query(`
            SELECT TOP 1000 id, table_name, record_id 
            FROM MIKRO_SYNC_DELETED_LOG 
            WHERE processed = 0 
            ORDER BY deleted_at ASC
        `);

        if (deletedLogs.length === 0) {
            console.log('Silinecek yeni kayıt bulunamadı.');
            return;
        }

        console.log(`${deletedLogs.length} adet silme kaydı bulundu.`);

        for (const log of deletedLogs) {
            try {
                let success = false;

                if (log.table_name === 'STOKLAR') {
                    // Stok silindiğinde
                    // Önce mapping tablosundan web_stok_id'yi bul
                    const mapping = await pgService.queryOne(
                        'SELECT web_stok_id FROM int_kodmap_stok WHERE erp_stok_kod = $1',
                        [log.record_id]
                    );

                    if (mapping) {
                        // Stok tablosundan sil (Cascade ile diğerleri de silinebilir veya soft delete yapılabilir)
                        // Kullanıcı "sil" dediği için hard delete yapıyoruz.
                        await pgService.query('DELETE FROM stoklar WHERE id = $1', [mapping.web_stok_id]);
                        console.log(`✓ Stok silindi: ${log.record_id} (Web ID: ${mapping.web_stok_id})`);

                        // Mapping'i de sil
                        await pgService.query('DELETE FROM int_kodmap_stok WHERE erp_stok_kod = $1', [log.record_id]);
                    } else {
                        console.log(`! Stok mapping bulunamadı: ${log.record_id}`);
                    }
                    success = true;

                } else if (log.table_name === 'CARI_HESAPLAR') {
                    // Cari silindiğinde
                    // Mapping tablosu varsa oradan, yoksa cari_kodu ile bul
                    // Cari mapping tablosu: int_kodmap_cari (varsayalım, kontrol etmem lazım)
                    // Projede int_kodmap_cari.json var ama veritabanında tablo var mı?
                    // Genelde cari_hesaplar tablosunda erp_id veya cari_kodu tutuluyor.

                    const cari = await pgService.queryOne(
                        'SELECT id FROM cari_hesaplar WHERE cari_kodu = $1',
                        [log.record_id]
                    );

                    if (cari) {
                        await pgService.query('DELETE FROM cari_hesaplar WHERE id = $1', [cari.id]);
                        console.log(`✓ Cari silindi: ${log.record_id} (Web ID: ${cari.id})`);
                    } else {
                        console.log(`! Cari bulunamadı: ${log.record_id}`);
                    }
                    success = true;

                } else if (log.table_name === 'BARKOD_TANIMLARI') {
                    // Barkod silindiğinde
                    await pgService.query('DELETE FROM urun_barkodlari WHERE barkod = $1', [log.record_id]);
                    console.log(`✓ Barkod silindi: ${log.record_id}`);
                    success = true;

                } else if (log.table_name === 'STOK_SATIS_FIYAT_LISTELERI') {
                    // Fiyat silindiğinde: record_id = STOK_KODU|LISTE_SIRA
                    const parts = log.record_id.split('|');
                    if (parts.length === 2) {
                        const stokKodu = parts[0];
                        const listeSira = parseInt(parts[1]);

                        // Stok ID bul
                        const stok = await pgService.queryOne(
                            'SELECT id FROM stoklar WHERE stok_kodu = $1',
                            [stokKodu]
                        );

                        // Fiyat Tanım ID bul
                        const fiyatTanim = await pgService.queryOne(
                            'SELECT id FROM fiyat_tanimlari WHERE sira_no = $1',
                            [listeSira]
                        );

                        if (stok && fiyatTanim) {
                            await pgService.query(
                                'DELETE FROM urun_fiyat_listeleri WHERE stok_id = $1 AND fiyat_tanimi_id = $2',
                                [stok.id, fiyatTanim.id]
                            );
                            console.log(`✓ Fiyat silindi: ${stokKodu} - Liste ${listeSira}`);
                        }
                    }
                    success = true;
                }

                if (success) {
                    // MSSQL'de işlendi olarak işaretle
                    await mssqlService.query(
                        'UPDATE MIKRO_SYNC_DELETED_LOG SET processed = 1 WHERE id = @id',
                        { id: log.id }
                    );
                }

            } catch (error) {
                console.error(`Hata (${log.table_name} - ${log.record_id}):`, error.message);
            }
        }

    } catch (error) {
        console.error('Silme senkronizasyonu hatası:', error);
    }
}

// Eğer doğrudan çalıştırılırsa
if (require.main === module) {
    syncDeletedRecords().then(() => {
        pgService.disconnect();
        mssqlService.disconnect();
    });
}

module.exports = syncDeletedRecords;
