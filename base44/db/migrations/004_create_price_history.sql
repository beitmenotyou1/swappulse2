-- ============================================================
-- Migration 004: Card Price History Table
-- Stores historical pricing snapshots for trend analysis.
-- Sources: Cardmarket (EUR), TCGplayer (USD)
-- Reference: https://tcgdex.dev/markets-prices
-- ============================================================

CREATE TABLE IF NOT EXISTS card_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_tcgdex_id TEXT NOT NULL REFERENCES cards(tcgdex_id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('cardmarket', 'tcgplayer')),
  -- Cardmarket: {"avg": 0.08, "low": 0.02, "trend": 0.08, "avg30": 0.08, ...}
  -- TCGplayer: {"normal": {"marketPrice": 0.09, "lowPrice": 0.02, ...}, "reverse": {...}}
  data JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One snapshot per card per source per day
  UNIQUE(card_tcgdex_id, source, DATE(recorded_at))
);

CREATE INDEX IF NOT EXISTS idx_price_history_card ON card_price_history(card_tcgdex_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON card_price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_source ON card_price_history(source);
CREATE INDEX IF NOT EXISTS idx_price_history_card_source_date
  ON card_price_history(card_tcgdex_id, source, recorded_at DESC);

COMMENT ON COLUMN card_price_history.source IS 'Pricing source: cardmarket (EUR) or tcgplayer (USD)';