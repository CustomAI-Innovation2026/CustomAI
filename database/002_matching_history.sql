-- ============================================================
-- DocScan AI – Matching History Table
-- Run in Supabase SQL Editor: Settings → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS matching_history (
  id            TEXT          PRIMARY KEY,          -- client-generated: timestamp36 + random
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  combo_label   TEXT,                               -- e.g. "BL vs Invoice vs Packing List"
  combo_types   JSONB         NOT NULL DEFAULT '[]', -- ["bill_of_lading","invoice","packing_list"]
  file_names    JSONB         NOT NULL DEFAULT '{}', -- { bill_of_lading: ["BL.pdf"], invoice: [...] }
  overall_score INTEGER,                            -- 0-100 overall match %
  pairs         JSONB         NOT NULL DEFAULT '[]'  -- full pairs array from n8n
);

CREATE INDEX IF NOT EXISTS idx_matching_history_created_at ON matching_history(created_at DESC);

-- RLS: open policy (same as other tables)
ALTER TABLE matching_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on matching_history" ON matching_history FOR ALL USING (true) WITH CHECK (true);
