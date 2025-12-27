const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

/**
 * Bu script, stok_hareketleri ve cari_hesap_hareketleri tablolarında olan
 * ama sync_queue'da olmayan kayıtları bulur ve sync_queue'ya ekler.
 */

async function checkAndFixMissingQueueItems() {
    try {
        console.log('🔍 Eksik sync_queue kayıtları kontrol ediliyor...\n');
        await pgService.pool.connect();

        // 1. STOK HAREKETLERİ - Web kaynaklı olanları kontrol et
        console.log('📦 Stok Hareketleri kontrol ediliyor...');
        const missingSthQuery = `
            SELECT sh.id, sh.belge_tipi, sh.islem_tarihi, sh.fatura_sira_no
            FROM stok_hareketleri sh
            LEFT JOIN sync_queue sq ON sq.entity_type = 'stok_hareket' AND sq.entity_id = sh.id
            WHERE sh.kaynak = 'web' 
              AND sh.belge_tipi IN ('satis', 'alis', 'iade', 'sayim')
              AND sq.id IS NULL
            ORDER BY sh.created_at DESC
            LIMIT 100
        `;

        const missingSth = await pgService.query(missingSthQuery);

        if (missingSth.length > 0) {
            console.log(`⚠️  ${missingSth.length} adet stok hareketi sync_queue'da eksik!`);

            for (const record of missingSth) {
                await pgService.query(`
                    INSERT INTO sync_queue (entity_type, entity_id, operation, status, created_at)
                    VALUES ('stok_hareket', $1, 'INSERT', 'pending', NOW())
                    ON CONFLICT (entity_type, entity_id) DO NOTHING
                `, [record.id]);

                console.log(`  ✓ Eklendi: ${record.belge_tipi} - ${record.fatura_sira_no} (${record.id})`);
            }
        } else {
            console.log('✅ Stok hareketlerinde eksik kayıt yok.\n');
        }

        // 2. CARİ HESAP HAREKETLERİ - Web kaynaklı satışları kontrol et
        console.log('\n💰 Cari Hesap Hareketleri kontrol ediliyor...');
        const missingChaQuery = `
            SELECT s.id, s.satis_no, s.satis_tarihi, s.toplam_tutar
            FROM satislar s
            LEFT JOIN sync_queue sq ON sq.entity_type = 'satis' AND sq.entity_id = s.id
            WHERE s.durum = 'onaylandi'
              AND sq.id IS NULL
            ORDER BY s.olusturma_tarihi DESC
            LIMIT 100
        `;

        const missingCha = await pgService.query(missingChaQuery);

        if (missingCha.length > 0) {
            console.log(`⚠️  ${missingCha.length} adet satış kaydı sync_queue'da eksik!`);

            for (const record of missingCha) {
                await pgService.query(`
                    INSERT INTO sync_queue (entity_type, entity_id, operation, status, created_at)
                    VALUES ('satis', $1, 'INSERT', 'pending', NOW())
                    ON CONFLICT (entity_type, entity_id) DO NOTHING
                `, [record.id]);

                console.log(`  ✓ Eklendi: Satış ${record.satis_no} - ${record.toplam_tutar} TL (${record.id})`);
            }
        } else {
            console.log('✅ Satış kayıtlarında eksik kayıt yok.\n');
        }

        // 3. ALIŞ FAT. - Onaylı alışları kontrol et
        console.log('\n📥 Alış Faturaları kontrol ediliyor...');
        const missingAlisQuery = `
            SELECT a.id, a.fatura_no, a.fatura_tarihi, a.toplam_tutar
            FROM alislar a
            LEFT JOIN sync_queue sq ON sq.entity_type = 'alislar' AND sq.entity_id = a.id
            WHERE a.alis_durumu = 'onaylandi'
              AND sq.id IS NULL
            ORDER BY a.created_at DESC
            LIMIT 100
        `;

        const missingAlis = await pgService.query(missingAlisQuery);

        if (missingAlis.length > 0) {
            console.log(`⚠️  ${missingAlis.length} adet alış faturası sync_queue'da eksik!`);

            for (const record of missingAlis) {
                await pgService.query(`
                    INSERT INTO sync_queue (entity_type, entity_id, operation, status, created_at)
                    VALUES ('alislar', $1, 'INSERT', 'pending', NOW())
                    ON CONFLICT (entity_type, entity_id) DO NOTHING
                `, [record.id]);

                console.log(`  ✓ Eklendi: Alış ${record.fatura_no} - ${record.toplam_tutar} TL (${record.id})`);
            }
        } else {
            console.log('✅ Alış faturalarında eksik kayıt yok.\n');
        }

        // 4. TAHSİLATLAR - Onaylı tahsilatları kontrol et
        console.log('\n💵 Tahsilatlar kontrol ediliyor...');
        const missingTahQuery = `
            SELECT t.id, t.tahsilat_tipi, t.tutar, t.tahsilat_tarihi
            FROM tahsilatlar t
            LEFT JOIN sync_queue sq ON sq.entity_type = 'tahsilat' AND sq.entity_id = t.id
            WHERE t.tahsilat_durumu = 'onaylandi'
              AND sq.id IS NULL
            ORDER BY t.olusturma_tarihi DESC
            LIMIT 100
        `;

        const missingTah = await pgService.query(missingTahQuery);

        if (missingTah.length > 0) {
            console.log(`⚠️  ${missingTah.length} adet tahsilat sync_queue'da eksik!`);

            for (const record of missingTah) {
                await pgService.query(`
                    INSERT INTO sync_queue (entity_type, entity_id, operation, status, created_at)
                    VALUES ('tahsilat', $1, 'INSERT', 'pending', NOW())
                    ON CONFLICT (entity_type, entity_id) DO NOTHING
                `, [record.id]);

                console.log(`  ✓ Eklendi: Tahsilat ${record.tahsilat_tipi} - ${record.tutar} TL (${record.id})`);
            }
        } else {
            console.log('✅ Tahsilatlarda eksik kayıt yok.\n');
        }

        console.log('\n✅ Kontrol tamamlandı!');

    } catch (error) {
        console.error('❌ Hata:', error);
        logger.error('Sync queue kontrol hatası:', error);
    } finally {
        await pgService.disconnect();
    }
}

checkAndFixMissingQueueItems();
