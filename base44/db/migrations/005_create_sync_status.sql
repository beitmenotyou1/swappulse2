-- ============================================================
-- Migration 005: Sync Status Table
-- Tracks periodic sync job status (catalog, pricing, localizations).
-- On Base44 this is implemented via the TcgdexSyncState entity.
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_status (
  job_name TEXT PRIMARY KEY,
  last_sync TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  duration_seconds INTEGER,
  -- Example: {"seriesProcessed": 15, "setsProcessed": 200, "cardsUpserted": 15000, "errors": []}
  stats JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sync_status (job_name, status) VALUES
  ('tcgdex_catalog', 'pending'),
  ('tcgdex_pricing', 'pending'),
  ('tcgdex_localizations', 'pending')
ON CONFLICT (job_name) DO NOTHING;

COMMENT ON TABLE sync_status IS 'Tracks periodic sync job status for monitoring';