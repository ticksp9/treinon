-- Training dossier, phase 3 (FPF certification, criteria 4.1 and 4.3):
--   · the history of each player's transition: training or playing with another (older) team, trials, promotions
--   · the club's internal training actions for the coaching staffs (courses, meetings, training observation)
-- The written transition plan itself lives in the guiding document (club_guidelines.content.transition).

-- ── a player training / playing with another team ──
CREATE TABLE IF NOT EXISTS public.player_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,          -- the player's team
  to_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,               -- the team they went to (of the club)
  to_team_name text CHECK (to_team_name IS NULL OR char_length(to_team_name) <= 120), -- or its name (another club)
  kind text NOT NULL DEFAULT 'training' CHECK (kind IN ('training', 'match', 'trial', 'promotion')),
  event_date date NOT NULL DEFAULT current_date,
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  evaluation text CHECK (evaluation IS NULL OR char_length(evaluation) <= 2000),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (to_team_id IS NOT NULL OR to_team_name IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS player_transitions_player_idx ON public.player_transitions (player_id, event_date DESC);
CREATE INDEX IF NOT EXISTS player_transitions_team_idx ON public.player_transitions (team_id, event_date DESC);
CREATE INDEX IF NOT EXISTS player_transitions_to_team_idx ON public.player_transitions (to_team_id) WHERE to_team_id IS NOT NULL;

-- the record belongs to the player's team at the time
CREATE OR REPLACE FUNCTION public.player_transition_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id = NEW.player_id AND p.team_id = NEW.team_id) THEN
    RAISE EXCEPTION 'the player is not in this team' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.player_id IS DISTINCT FROM OLD.player_id OR NEW.team_id IS DISTINCT FROM OLD.team_id) THEN
    RAISE EXCEPTION 'the player and team of a record do not change' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) - 'updated_at' - 'created_by' IS DISTINCT FROM to_jsonb(OLD) - 'updated_at' - 'created_by' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS player_transition_check ON public.player_transitions;
CREATE TRIGGER player_transition_check BEFORE INSERT OR UPDATE ON public.player_transitions
  FOR EACH ROW EXECUTE FUNCTION public.player_transition_check();

-- ── the club's internal training actions for its coaches ──
CREATE TABLE IF NOT EXISTS public.club_training_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  kind text NOT NULL DEFAULT 'course' CHECK (kind IN ('course', 'meeting', 'observation', 'external')),
  action_date date NOT NULL,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 6000),
  trainer text CHECK (trainer IS NULL OR char_length(trainer) <= 200),
  topics text CHECK (topics IS NULL OR char_length(topics) <= 4000),
  attendees text CHECK (attendees IS NULL OR char_length(attendees) <= 4000),
  all_staff boolean NOT NULL DEFAULT false,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((club_id IS NULL) <> (owner_id IS NULL))
);
CREATE INDEX IF NOT EXISTS club_training_actions_club_idx ON public.club_training_actions (club_id, action_date DESC);
CREATE INDEX IF NOT EXISTS club_training_actions_owner_idx ON public.club_training_actions (owner_id, action_date DESC);
DROP TRIGGER IF EXISTS club_training_actions_touch ON public.club_training_actions;
CREATE TRIGGER club_training_actions_touch BEFORE UPDATE ON public.club_training_actions
  FOR EACH ROW EXECUTE FUNCTION public.dossier_touch();

-- ── access ──
ALTER TABLE public.player_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_training_actions ENABLE ROW LEVEL SECURITY;

-- the staff of both teams see and write it (parents and players never)
DROP POLICY IF EXISTS "player_transitions_staff" ON public.player_transitions;
CREATE POLICY "player_transitions_staff" ON public.player_transitions FOR ALL TO authenticated
  USING (public.can_coach_team(auth.uid(), team_id) OR (to_team_id IS NOT NULL AND public.can_coach_team(auth.uid(), to_team_id)))
  WITH CHECK (public.can_coach_team(auth.uid(), team_id) OR (to_team_id IS NOT NULL AND public.can_coach_team(auth.uid(), to_team_id)));

DROP POLICY IF EXISTS "club_training_actions_read" ON public.club_training_actions;
CREATE POLICY "club_training_actions_read" ON public.club_training_actions FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_read_club_guidelines(auth.uid(), club_id));
DROP POLICY IF EXISTS "club_training_actions_write" ON public.club_training_actions;
CREATE POLICY "club_training_actions_write" ON public.club_training_actions FOR ALL TO authenticated
  USING (CASE WHEN club_id IS NULL THEN owner_id = auth.uid() ELSE public.can_edit_club_guidelines(auth.uid(), club_id) END)
  WITH CHECK (CASE WHEN club_id IS NULL THEN owner_id = auth.uid() ELSE public.can_edit_club_guidelines(auth.uid(), club_id) END);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_transitions, public.club_training_actions TO authenticated;
REVOKE ALL ON public.player_transitions, public.club_training_actions FROM anon;
