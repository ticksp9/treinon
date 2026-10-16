-- Teams that train together (e.g. Sub-12 and Sub-13 on the same pitch, separate only on match day).
--   teams.trains_with        : the other teams of the same training (kept on both sides by the app)
--   attendance_sheets.session_map : one sheet for all of them — for each team, its training of each
--                              column ({ "<team id>": ["<session id>", …] }), so a signature is saved
--                              in the player's own team.

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS trains_with uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.attendance_sheets ADD COLUMN IF NOT EXISTS session_map jsonb
  CHECK (session_map IS NULL OR jsonb_typeof(session_map) = 'object');
