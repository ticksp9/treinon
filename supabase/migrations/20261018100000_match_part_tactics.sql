-- The tactic each part of a match started with ({"1": {formation, slots, layout}, "2": …}),
-- saved by the live match when the part starts; the match report draws the starting line-up from it.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS part_tactics jsonb
  CHECK (part_tactics IS NULL OR jsonb_typeof(part_tactics) = 'object');
