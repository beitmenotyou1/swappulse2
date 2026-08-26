-- ============================================================
-- Migration 006: Additional Performance Indexes
-- Optimises common query patterns for the SwapPulse frontend.
-- ============================================================

-- Full-text search across all localised card names
CREATE OR REPLACE FUNCTION card_names_tsvector(localizations JSONB)
RETURNS TSVECTOR AS $$
DECLARE
  result TSVECTOR := to_tsvector('simple', '');
  lang TEXT;
  card_name TEXT;
BEGIN
  FOR lang IN SELECT jsonb_object_keys(localizations)
  LOOP
    card_name := (localizations -> lang ->> 'name');
    IF card_name IS NOT NULL THEN
      result := result || to_tsvector('simple', card_name);
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE INDEX IF NOT EXISTS idx_cards_fulltext_names
  ON cards USING GIN(card_names_tsvector(localizations));

-- Expression index for English name (most common lookup)
CREATE INDEX IF NOT EXISTS idx_cards_name_en
  ON cards((localizations -> 'en' ->> 'name'));

-- Covering index for card grid display query
CREATE INDEX IF NOT EXISTS idx_cards_grid_cover
  ON cards(set_id, rarity)
  INCLUDE (tcgdex_id, local_id, name, image_url, category, localizations);

-- Covering index for pricing display
CREATE INDEX IF NOT EXISTS idx_cards_pricing_display
  ON cards(tcgdex_id)
  INCLUDE (name, rarity, pricing_data, pricing_updated)
  WHERE pricing_data IS NOT NULL AND pricing_data != '{}';

-- Set completion tracking
CREATE INDEX IF NOT EXISTS idx_cards_set_completion
  ON cards(set_id, tcgdex_id)
  INCLUDE (local_id, name, rarity, image_url);