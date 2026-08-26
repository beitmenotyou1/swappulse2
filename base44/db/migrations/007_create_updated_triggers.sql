-- ============================================================
-- Migration 007: Auto-Update Triggers
-- Automatically updates updated_at on row modification.
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_card_series_updated ON card_series;
CREATE TRIGGER trg_card_series_updated
  BEFORE UPDATE ON card_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_card_sets_updated ON card_sets;
CREATE TRIGGER trg_card_sets_updated
  BEFORE UPDATE ON card_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cards_updated ON cards;
CREATE TRIGGER trg_cards_updated
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sync_status_updated ON sync_status;
CREATE TRIGGER trg_sync_status_updated
  BEFORE UPDATE ON sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION update_updated_at_column IS 'Auto-updates updated_at on row modification';