-- Quick post-match entry: when the match was not run live, the coach types each
-- player's minutes per part afterwards. { "<player_id>": [m1, m2, m3] }
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS manual_minutes jsonb;
COMMENT ON COLUMN public.matches.manual_minutes IS
  'Minutes per part typed after the match (quick entry); when present, reports use these instead of the live timing.';
