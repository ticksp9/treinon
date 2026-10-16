-- Training days and the paper attendance sheet.
--   teams.training_schedule : the team's week, e.g. [{"day":1,"time":"18:30"},{"day":3,"time":"18:30"}]
--                             (day 0 = Sunday … 6 = Saturday), used to create the trainings ahead
--   attendance_sheets       : each sheet printed for the players to sign: which trainings are its
--                             columns and which players its rows, in order, so a photo of the
--                             signed sheet can be read back into the attendance.

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS training_schedule jsonb
  CHECK (training_schedule IS NULL OR jsonb_typeof(training_schedule) = 'array');

CREATE TABLE IF NOT EXISTS public.attendance_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9]{4,8}$'),
  session_ids uuid[] NOT NULL CHECK (cardinality(session_ids) BETWEEN 1 AND 12),
  player_ids uuid[] NOT NULL CHECK (cardinality(player_ids) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attendance_sheets_team_idx ON public.attendance_sheets (team_id, created_at DESC);

ALTER TABLE public.attendance_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_sheets_staff" ON public.attendance_sheets;
CREATE POLICY "attendance_sheets_staff" ON public.attendance_sheets FOR ALL TO authenticated
  USING (public.can_coach_team(auth.uid(), team_id))
  WITH CHECK (public.can_coach_team(auth.uid(), team_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sheets TO authenticated;
REVOKE ALL ON public.attendance_sheets FROM anon;
