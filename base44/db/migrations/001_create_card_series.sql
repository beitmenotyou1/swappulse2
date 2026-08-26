-- ============================================================
-- Migration 001: Card Series Table
-- Stores TCGDex series data with multi-language localizations.
-- TCGDex Reference: https://tcgdex.dev/reference/serie
-- NOTE: On Base44, this schema is implemented via the TcgdexCard entity.
--       These SQL files serve as reference for self-hosted deployments.
-- ============================================================

CREATE TABLE IF NOT EXISTS card_series (
  tcgdex_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  localizations JSONB NOT NULL DEFAULT '{}',
  logo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_series_name ON card_series(name);
CREATE INDEX IF NOT EXISTS idx_card_series_localizations ON card_series USING GIN(localizations);

COMMENT ON TABLE card_series IS 'TCGDex card series (e.g., Sword & Shield) with multi-language support';
COMMENT ON COLUMN card_series.localizations IS 'JSONB map: {lang_code: {name, logo}} for all 17 supported languages';