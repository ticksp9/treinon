ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS part_starter_ids jsonb,
  ADD COLUMN IF NOT EXISTS part_real_seconds integer[],
  ADD COLUMN IF NOT EXISTS part_regulation_minutes integer[],
  ADD COLUMN IF NOT EXISTS parts_count integer;

COMMENT ON COLUMN public.matches.part_starter_ids IS 'Authoritative starter snapshots by part index, e.g. {"1": [uuid], "2": [uuid]}.';
COMMENT ON COLUMN public.matches.part_real_seconds IS 'Actual elapsed seconds by part index.';
COMMENT ON COLUMN public.matches.part_regulation_minutes IS 'Regulation duration minutes by part index.';
COMMENT ON COLUMN public.matches.parts_count IS 'Configured number of match parts.';