-- Match format chosen by the coach at the start of the season, per team.
-- Each association (and each season) defines its own: e.g. 3 parts of 15 + 15 + 30 min.
-- Shape: { "parts": [15, 15, 30] }  (minutes of each part, in order)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS match_format jsonb;

COMMENT ON COLUMN public.teams.match_format IS
  'Default match format for this team: {"parts": [minutes per part]} — e.g. {"parts":[15,15,30]}';
