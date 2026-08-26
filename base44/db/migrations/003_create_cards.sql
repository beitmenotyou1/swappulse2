-- ============================================================
-- Migration 003: Cards Table
-- Stores TCGDex card data with multi-language localizations,
-- full game stats, variants, and pricing data.
-- TCGDex Reference: https://tcgdex.dev/reference/card
-- ============================================================

CREATE TABLE IF NOT EXISTS cards (
  tcgdex_id TEXT PRIMARY KEY,
  local_id TEXT NOT NULL,
  name TEXT NOT NULL,
  -- JSONB map: {lang_code: {name, description, image}}
  localizations JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('Pokemon', 'Energy', 'Trainer')),
  illustrator TEXT,
  rarity TEXT,
  set_id TEXT REFERENCES card_sets(tcgdex_id) ON DELETE CASCADE,
  variants JSONB DEFAULT '{}',
  hp INTEGER,
  types JSONB DEFAULT '[]',
  stage TEXT,
  evolve_from TEXT,
  attacks JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  retreat INTEGER,
  regulation_mark TEXT,
  legal JSONB DEFAULT '{"standard": false, "expanded": false}',
  -- Cardmarket (EUR) + TCGplayer (USD) from https://tcgdex.dev/markets-prices
  pricing_data JSONB DEFAULT '{}',
  pricing_updated TIMESTAMPTZ,
  boosters JSONB DEFAULT '[]',
  needs_pricing_update BOOLEAN DEFAULT true,
  tcgdex_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cards_set_id ON cards(set_id);
CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category);
CREATE INDEX IF NOT EXISTS idx_cards_illustrator ON cards(illustrator);
CREATE INDEX IF NOT EXISTS idx_cards_set_local_id ON cards(set_id, local_id);
CREATE INDEX IF NOT EXISTS idx_cards_localizations ON cards USING GIN(localizations);
CREATE INDEX IF NOT EXISTS idx_cards_types ON cards USING GIN(types);
CREATE INDEX IF NOT EXISTS idx_cards_attacks ON cards USING GIN(attacks);
CREATE INDEX IF NOT EXISTS idx_cards_needs_pricing ON cards(needs_pricing_update) WHERE needs_pricing_update = true;
CREATE INDEX IF NOT EXISTS idx_cards_tcgdex_updated ON cards(tcgdex_updated);
CREATE INDEX IF NOT EXISTS idx_cards_pokemon_hp ON cards(hp) WHERE category = 'Pokemon';

COMMENT ON COLUMN cards.localizations IS 'JSONB map: {lang_code: {name, description, image}} for all 17 supported languages';
COMMENT ON COLUMN cards.pricing_data IS 'JSONB: {cardmarket: {...EUR pricing...}, tcgplayer: {...USD pricing...}}';