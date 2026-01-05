const sqliteService = require('../services/sqlite.service');

async function analyzeRelations() {
    console.log('=== TABLO İLİŞKİ ANALİZİ ===\n');

    try {
        // 1. Önce son bir siparişi alalım
        const order = sqliteService.queryOne(`
            SELECT * FROM 'order' 
            ORDER BY id DESC 
            LIMIT 1
        `);

        if (!order) {
            console.log('Hiç sipariş bulunamadı.');
            return;
        }

        console.log(`ÖRNEK SİPARİŞ (ID: ${order.id}, No: ${order.no})`);
        console.log('--------------------------------------------------');
        console.log('Temel Alanlar:', {
            id: order.id,
            no: order.no,
            status: order.status,
            customer_id: order.customer_id,
            email: order.email
        });

        // Order tablosundaki 'status' veya benzeri kolonları kontrol edelim
        const orderCols = sqliteService.query(`PRAGMA table_info('order')`);
        const statusRelatedCols = orderCols.filter(c => c.name.includes('status')).map(c => c.name);
        console.log('Order tablosundaki status ile ilgili kolonlar:', statusRelatedCols);
        console.log('\n');


        // 2. Order Product İlişkisi
        console.log(`1. ORDER -> ORDER_PRODUCT İLİŞKİSİ`);
        const products = sqliteService.query(`
            SELECT * FROM 'order_product' 
            WHERE order_id = ?
        `, [order.id]);

        console.log(`   'order_product' tablosunda order_id=${order.id} olan ${products.length} kayıt bulundu.`);
        if (products.length > 0) {
            console.log('   Örnek Ürün:', {
                id: products[0].id,
                order_id: products[0].order_id,
                name: products[0].name,
                model: products[0].model
            });
            console.log('   ✓ BAĞLANTI: order.id = order_product.order_id');
        } else {
            console.log('   X Bağlantı bulunamadı (order_id kolonu kontrol edilmeli)');
        }
        console.log('\n');


        // 3. Order Status İlişkisi
        console.log(`2. ORDER -> ORDER_STATUS İLİŞKİSİ`);
        const statuses = sqliteService.query(`SELECT * FROM 'order_status'`);
        console.log('   Mevcut Status Tanımları:', statuses.map(s => `${s.id}:${s.name}`).join(', '));

        // Eşleştirme Kontrolü
        const matchedStatus = statuses.find(s => s.name === order.status || s.id == order.status);
        if (matchedStatus) {
            console.log(`   Siparişteki status değeri ("${order.status}") listede bulundu.`);
            if (order.status === matchedStatus.name) {
                console.log('   ✓ BAĞLANTI: order.status (String) = order_status.name');
            } else {
                console.log('   ✓ BAĞLANTI: order.status (ID) = order_status.id');
            }
        } else {
            console.log(`   Siparişteki status değeri ("${order.status}") order_status tablosunda bulunamadı.`);
            console.log('   Not: Bu veritabanında status ID yerine doğrudan metin yazılıyor olabilir.');
        }
        console.log('\n');


        // 4. Messages İlişkisi
        console.log(`3. ORDER -> MESSAGES İLİŞKİSİ`);
        // Mesaj tablosunun yapısını görelim
        const msgCols = sqliteService.query(`PRAGMA table_info('messages')`).map(c => c.name);
        console.log('   Messages Konları:', msgCols);

        // Olası bağlantıları test edelim
        let messages = [];
        let linkType = 'Bilinmiyor';

        if (msgCols.includes('order_id')) {
            messages = sqliteService.query(`SELECT * FROM 'messages' WHERE order_id = ?`, [order.id]);
            linkType = 'order_id';
        }

        if (messages.length === 0 && msgCols.includes('order_no')) {
            // Bir de order no ile deneyelim (String olabilir)
            messages = sqliteService.query(`SELECT * FROM 'messages' WHERE order_no = ?`, [order.no]);
            linkType = 'order_no';
        }

        // Eğer bu siparişe ait mesaj yoksa, genel bir mesaj bulup yapısını inceleyelim
        if (messages.length === 0) {
            const anyMsg = sqliteService.queryOne(`SELECT * FROM 'messages' LIMIT 1`);
            if (anyMsg) {
                console.log('   Bu siparişe ait mesaj yok ama örnek bir mesaj bulundu:');
                console.log('   ', anyMsg);
                if (anyMsg.order_id) console.log('   ✓ Genelleme: messages.order_id üzerinden bağlanıyor.');
                else if (anyMsg.order_no) console.log('   ✓ Genelleme: messages.order_no üzerinden bağlanıyor.');
            } else {
                console.log('   Tabloda hiç mesaj yok.');
            }
        } else {
            console.log(`   Bu sipariş için ${messages.length} mesaj bulundu. Bağlantı: ${linkType}`);
        }

    } catch (err) {
        console.error('Hata:', err);
    }
}

analyzeRelations();
