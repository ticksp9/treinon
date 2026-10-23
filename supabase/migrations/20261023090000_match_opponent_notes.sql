-- Notes about the opponent written in the match report.
-- They are saved as the opponent sheet's observation of that match (one per match), so they show
-- in Scouting and in the printable opponent report the next time we play them.
ALTER TABLE public.scout_opponent_observations
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  -- [{ "number": "10", "name": "…", "note": "…", "key": true }]
  ADD COLUMN IF NOT EXISTS player_notes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.scout_opponent_observations
  DROP CONSTRAINT IF EXISTS scout_opponent_observations_player_notes_check;
ALTER TABLE public.scout_opponent_observations
  ADD CONSTRAINT scout_opponent_observations_player_notes_check
  CHECK (jsonb_typeof(player_notes) = 'array' AND jsonb_array_length(player_notes) <= 40 AND pg_column_size(player_notes) <= 40000);

CREATE UNIQUE INDEX IF NOT EXISTS scout_opponent_observations_match_uidx
  ON public.scout_opponent_observations (match_id) WHERE match_id IS NOT NULL;
