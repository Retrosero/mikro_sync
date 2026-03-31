const pgService = require('./services/postgresql.service');

async function updateTriggers() {
    try {
        console.log('--- Updating Sync Triggers to prevent duplicates ---');

        // Satış Trigger Fonksiyonu Güncelleme
        await pgService.query(`
            CREATE OR REPLACE FUNCTION notify_satis_sync()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Sadece Web'den oluşturulan satışlar için sync yap
                IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
                    -- Eğer zaten bu entity için bekleyen (pending) bir kayıt varsa, yeni ekleme
                    IF NOT EXISTS (
                        SELECT 1 FROM sync_queue 
                        WHERE entity_type IN ('satis', 'satislar') 
                        AND entity_id = NEW.id 
                        AND status = 'pending'
                    ) THEN
                        INSERT INTO sync_queue (entity_type, entity_id, operation, status)
                        VALUES ('satislar', NEW.id, TG_OP, 'pending');
                    END IF;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Tahsilat Trigger Fonksiyonu Güncelleme
        await pgService.query(`
            CREATE OR REPLACE FUNCTION notify_tahsilat_sync()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Sadece Web'den oluşturulan tahsilatlar için sync yap
                IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
                    -- Eğer zaten bu entity için bekleyen (pending) bir kayıt varsa, yeni ekleme
                    IF NOT EXISTS (
                        SELECT 1 FROM sync_queue 
                        WHERE entity_type IN ('tahsilat', 'tahsilatlar') 
                        AND entity_id = NEW.id 
                        AND status = 'pending'
                    ) THEN
                        INSERT INTO sync_queue (entity_type, entity_id, operation, status)
                        VALUES ('tahsilatlar', NEW.id, TG_OP, 'pending');
                    END IF;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Alış Trigger Fonksiyonu Güncelleme
        await pgService.query(`
            CREATE OR REPLACE FUNCTION notify_alis_sync()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Sadece Web'den oluşturulan alışlar için sync yap
                IF NEW.kaynak IS NULL OR NEW.kaynak = 'web' THEN
                    -- Eğer zaten bu entity için bekleyen (pending) bir kayıt varsa, yeni ekleme
                    IF NOT EXISTS (
                        SELECT 1 FROM sync_queue 
                        WHERE entity_type IN ('alis', 'alislar') 
                        AND entity_id = NEW.id 
                        AND status = 'pending'
                    ) THEN
                        INSERT INTO sync_queue (entity_type, entity_id, operation, status)
                        VALUES ('alislar', NEW.id, TG_OP, 'pending');
                    END IF;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        console.log('✓ Trigger fonksiyonları başarıyla güncellendi.');

    } catch (error) {
        console.error('Trigger güncelleme hatası:', error);
    } finally {
        process.exit(0);
    }
}

updateTriggers();
