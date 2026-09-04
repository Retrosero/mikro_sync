require('dotenv').config();

const pgService = require('../services/postgresql.service');
const SyncQueueWorker = require('../services/sync-queue-worker');

async function processOne(worker, item) {
  await pgService.query(
    `UPDATE sync_queue
     SET status = 'processing', retry_count = 0, error_message = NULL
     WHERE id = $1`,
    [item.id]
  );

  await worker.processItem({ ...item, retry_count: 0 }, true);
  const current = await pgService.query(
    'SELECT status FROM sync_queue WHERE id = $1',
    [item.id]
  );
  return current[0]?.status;
}

async function main() {
  const worker = new SyncQueueWorker();
  try {
    // Her satış için en yeni tek başarısız kaydı seç. Diğer kopyalar yalnızca
    // aynı satışın eşzamanlı üretilmiş yinelenen kuyruk kayıtlarıdır.
    const sales = await pgService.query(`
      SELECT DISTINCT ON (q.entity_id)
        q.id, q.entity_type, q.entity_id, q.operation, q.record_data
      FROM sync_queue q
      WHERE q.status = 'failed'
        AND q.entity_type = 'satislar'
        AND EXISTS (
          SELECT 1
          FROM satis_kalemleri sk
          WHERE sk.satis_id = q.entity_id
            AND sk.stok_id IS NULL
            AND sk.xml_stok_id IS NOT NULL
        )
      ORDER BY q.entity_id, q.processed_at DESC NULLS LAST, q.id
    `);

    let completedSales = 0;
    for (const sale of sales) {
      const status = await processOne(worker, sale);
      if (status === 'completed') {
        completedSales += 1;
        await pgService.query(
          `UPDATE sync_queue
           SET status = 'completed',
               processed_at = NOW(),
               error_message = 'Yinelenen başarısız kuyruk kaydı: asıl kayıt başarıyla işlendi'
           WHERE status = 'failed'
             AND entity_type = 'satislar'
             AND entity_id = $1`,
          [sale.entity_id]
        );
      }
    }

    const collections = await pgService.query(`
      SELECT id, entity_type, entity_id, operation, record_data
      FROM sync_queue
      WHERE status = 'failed'
        AND entity_type = 'tahsilatlar'
        AND entity_id = 'c5a5d13b-5628-41dd-8f77-0935c68a6be3'
    `);

    let completedCollections = 0;
    for (const collection of collections) {
      if (await processOne(worker, collection) === 'completed') {
        completedCollections += 1;
      }
    }

    console.log(`Tekrar işlenen XML satış: ${completedSales}/${sales.length}`);
    console.log(`Tekrar işlenen tahsilat: ${completedCollections}/${collections.length}`);
  } finally {
    await pgService.disconnect();
  }
}

main().catch(error => {
  console.error('Düzeltilen kayıtları yeniden işleme hatası:', error);
  process.exitCode = 1;
});
