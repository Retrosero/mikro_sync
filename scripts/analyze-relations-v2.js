const sqliteService = require('../services/sqlite.service');

async function analyzeRelations() {
    console.log('=== TABLO İLİŞKİ ANALİZİ V2 ===\n');

    try {
        // 1. Order Status Tablosu (Referans)
        console.log('1. ORDER_STATUS TABLOSU');
        const statuses = sqliteService.query(`SELECT id, name FROM 'order_status'`);
        if (statuses.length > 0) {
            statuses.forEach(s => console.log(`   ID: ${s.id} -> ${s.name}`));
        } else {
            const cols = sqliteService.query("PRAGMA table_info('order_status')");
            console.log('   KOLONLAR:', cols.map(c => c.name));
            console.log('   (Tablo boş veya yapı farklı)');
        }
        console.log('\n');

        // 2. Örnek Sipariş
        console.log('2. ÖRNEK SİPARİŞ');
        const order = sqliteService.queryOne(`SELECT * FROM 'order' WHERE status IS NOT NULL LIMIT 1`);
        if (!order) { console.log('Sipariş yok'); return; }

        console.log(`   Order ID: ${order.id}`);
        console.log(`   Order No: ${order.no}`);
        console.log(`   Order Status: ${order.status}`);
        console.log(`   Customer ID: ${order.customer_id}`);
        console.log('\n');

        // 3. Order Product
        console.log('3. ORDER PRODUCT');
        const prod = sqliteService.queryOne(`SELECT * FROM 'order_product' WHERE order_id = ?`, [order.id]);
        if (prod) {
            console.log(`   Bulunan Ürün ID: ${prod.id}`);
            console.log(`   Bağlantı: order_product.order_id (${prod.order_id}) = order.id (${order.id})`);
        } else {
            // Belki kolon adı farklıdır
            const opCols = sqliteService.query("PRAGMA table_info('order_product')");
            console.log('   Ürün bulunamadı. Tablo kolonları:', opCols.map(c => c.name).join(', '));
        }
        console.log('\n');

        // 4. Messages
        console.log('4. MESSAGES');
        const msgCols = sqliteService.query("PRAGMA table_info('messages')").map(c => c.name);
        console.log('   Kolonlar:', msgCols.join(', '));

        const sampleMsg = sqliteService.queryOne(`SELECT * FROM 'messages' WHERE order_number IS NOT NULL OR conversation_id IS NOT NULL LIMIT 1`);
        if (sampleMsg) {
            console.log('   Dolu veri örneği:');
            console.log(`   ID: ${sampleMsg.id}`);
            console.log(`   order_number: ${sampleMsg.order_number}`);
            console.log(`   supplier: ${sampleMsg.supplier}`);
            console.log(`   date: ${sampleMsg.date}`);
        } else {
            console.log('   Örnek mesaj verisi bulunamadı (Tüm order_number alanları boş olabilir).');
            const anyMsg = sqliteService.queryOne(`SELECT * FROM 'messages' LIMIT 1`);
            console.log('   Rastgele Mesaj:', anyMsg);
        }

    } catch (err) {
        console.error(err);
    }
}

analyzeRelations();
