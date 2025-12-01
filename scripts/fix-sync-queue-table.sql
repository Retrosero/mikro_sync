-- Sync Queue Tablosunu Düzelt
-- Eğer tablo varsa sil ve yeniden oluştur

DROP TABLE IF EXISTS sync_queue CASCADE;

CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);
CREATE INDEX idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

-- Başarı mesajı
SELECT 'Sync queue tablosu başarıyla oluşturuldu!' as message;
