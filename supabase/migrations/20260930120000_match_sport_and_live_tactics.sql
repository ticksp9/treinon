-- Per-match settings chosen by the coach.
-- sport_type: overrides the team's modality for this match only (e.g. a Sub-12 F7
--             team playing an 11-a-side friendly). NULL = use the team's.
-- live_tactics: formation shown on the live pitch and who plays in each slot:
--             { "formation": "4-3-3", "slots": { "GK": "<player uuid>", ... } }
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS sport_type text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS live_tactics jsonb;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_sport_type_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_sport_type_check
  CHECK (sport_type IS NULL OR sport_type IN ('football_5', 'football_7', 'football_9', 'football_11', 'futsal'));
