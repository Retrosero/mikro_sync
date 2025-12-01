require('dotenv').config();
const pgService = require('../services/postgresql.service');
const { v4: uuidv4 } = require('uuid');

async function createTestSale() {
    try {
        const customerId = 'a07078d2-eb8a-4168-9eb8-0cb3ff8de1ca'; // ADENYA OTEL MARKET SERHAN ÖZER
        const satisId = uuidv4();

        console.log(`Creating test sale for customer ${customerId}...`);

        // 1. Satış Başlığı Oluştur
        await pgService.query(`
            INSERT INTO satislar (
                id, cari_hesap_id, satis_no, satis_tarihi, 
                toplam_tutar, indirim_tutari, 
                durum, notlar, olusturma_tarihi, kaynak
            ) VALUES (
                $1, $2, $3, NOW(), 
                100.00, 0.00, 
                'onay_bekliyor', 'Test Siparişi - Serhan', NOW(), 'web'
            )
        `, [satisId, customerId, 'TEST-SERHAN-004']);

        console.log(`Sale header created with ID: ${satisId}`);

        // 2. Satış Detayı (Kalem) Oluştur
        const stok = await pgService.queryOne('SELECT id, stok_kodu, satis_fiyati FROM stoklar LIMIT 1');

        if (stok) {
            await pgService.query(`
                INSERT INTO satis_kalemleri (
                    satis_id, stok_id, miktar, 
                    birim_fiyat, toplam_tutar, kdv_orani, sira_no
                ) VALUES (
                    $1, $2, 1, 
                    100.00, 100.00, 20, 1
                )
            `, [satisId, stok.id]);
            console.log(`Sale detail created for stock: ${stok.stok_kodu}`);
        } else {
            console.log("No stock found to add to sale.");
        }

        // 3. Sync Queue Kontrol
        // Columns: entity_type, entity_id, operation, status, created_at
        const queueItem = await pgService.queryOne(`
            SELECT * FROM sync_queue 
            WHERE entity_id = $1
        `, [satisId]);

        if (queueItem) {
            console.log("✓ Trigger worked! Sale is in sync_queue.");
        } else {
            console.log("! Trigger did NOT work. Adding to queue manually...");
            await pgService.query(`
                INSERT INTO sync_queue (
                    entity_type, entity_id, operation, status, created_at
                ) VALUES (
                    'satislar', $1, 'INSERT', 'pending', NOW()
                )
            `, [satisId]);
        }

    } catch (error) {
        console.error("Error creating test sale:", error);
    } finally {
        await pgService.disconnect();
    }
}

createTestSale();
