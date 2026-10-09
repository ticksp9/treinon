-- Called-up players who did not come to the match (ill, injured, no-show):
-- { "<player_id>": "<reason>" }. They are removed from the lineup, the reason stays here.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS absences jsonb NOT NULL DEFAULT '{}'::jsonb;
