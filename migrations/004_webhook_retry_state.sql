ALTER TABLE whatsapp_webhook_inbox
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

UPDATE whatsapp_webhook_inbox
SET dead_lettered_at = CURRENT_TIMESTAMP
WHERE processed_at IS NULL AND attempt_count >= 10 AND dead_lettered_at IS NULL;

DROP INDEX IF EXISTS whatsapp_webhook_pending_idx;
CREATE INDEX whatsapp_webhook_pending_idx
    ON whatsapp_webhook_inbox (next_attempt_at, received_at)
    WHERE processed_at IS NULL AND dead_lettered_at IS NULL;
