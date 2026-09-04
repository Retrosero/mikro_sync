require('dotenv').config();

const pgService = require('../services/postgresql.service');

async function hardenSyncQueue() {
  try {
    // Aynı aktif satış kaydının ikinci kopyası geçmişte aylarca processing
    // durumunda kalmış. En eski kaydı koruyup diğerini tamamlandı olarak
    // işaretliyoruz; veri silinmez ve audit izi error_message'da kalır.
    const deduplicated = await pgService.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY entity_type, entity_id
                 ORDER BY created_at, id
               ) AS row_no
        FROM sync_queue
        WHERE status IN ('pending', 'processing')
      )
      UPDATE sync_queue q
      SET status = 'completed',
          processed_at = NOW(),
          error_message = 'Yinelenen aktif kuyruk kaydı: otomatik olarak bastırıldı'
      FROM ranked r
      WHERE q.id = r.id AND r.row_no > 1
      RETURNING q.id
    `);

    // Trigger kontrolü tek başına eşzamanlı iki INSERT'i engelleyemez.
    // Kısmi unique index, bir entity için yalnızca bir aktif işi garanti eder.
    await pgService.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_queue_active_entity
      ON sync_queue (entity_type, entity_id)
      WHERE status IN ('pending', 'processing')
    `);

    await pgService.query(`
      CREATE OR REPLACE FUNCTION public.notify_satis_sync()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
          INSERT INTO sync_queue (entity_type, entity_id, operation, status)
          VALUES ('satislar', NEW.id, TG_OP, 'pending')
          ON CONFLICT DO NOTHING;
        END IF;
        RETURN NEW;
      END;
      $$
    `);

    console.log(`Kuyruk sağlamlaştırıldı. Bastırılan yinelenen aktif kayıt: ${deduplicated.length}`);
  } finally {
    await pgService.disconnect();
  }
}

hardenSyncQueue().catch(error => {
  console.error('Kuyruk sağlamlaştırma hatası:', error);
  process.exitCode = 1;
});
