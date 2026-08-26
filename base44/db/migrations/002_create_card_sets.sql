-- ============================================================
-- Migration 002: Card Sets Table
-- Stores TCGDex set data with multi-language localizations.
-- TCGDex Reference: https://tcgdex.dev/reference/set
-- ============================================================

CREATE TABLE IF NOT EXISTS card_sets (
  tcgdex_id TEXT PRIMARY KEY,
  serie_id TEXT REFERENCES card_series(tcgdex_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  localizations JSONB NOT NULL DEFAULT '{}',
  logo TEXT,
  symbol TEXT,
  release_date DATE,
  card_count JSONB NOT NULL DEFAULT '{}',
  legal JSONB NOT NULL DEFAULT '{"standard": false, "expanded": false}',
  tcg_online_code TEXT,
  boosters JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_sets_serie_id ON card_sets(serie_id);
CREATE INDEX IF NOT EXISTS idx_card_sets_name ON card_sets(name);
CREATE INDEX IF NOT EXISTS idx_card_sets_release_date ON card_sets(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_card_sets_localizations ON card_sets USING GIN(localizations);
CREATE INDEX IF NOT EXISTS idx_card_sets_card_count ON card_sets USING GIN(card_count);

COMMENT ON COLUMN card_sets.localizations IS 'JSONB map: {lang_code: {name, logo, symbol}} for all 17 supported languages';
COMMENT ON COLUMN card_sets.card_count IS 'JSONB: {total, official, reverse, holo, normal, firstEd}';