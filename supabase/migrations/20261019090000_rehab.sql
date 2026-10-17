-- Medical department, part 2: getting back to play.
--   * The rehab of an injury goes by phases, each passed on criteria (not on days):
--     player_injuries.rehab_protocol ('standard' | 'concussion'), rehab_phase (1–6),
--     rehab_phase_since, rehab_checks ({"<phase>": [criteria done]}) and rehab_history.
--     The phase is not clinical: coaches see it (it tells them what the player can do).
--   * Concussion: the player is not cleared before the last phase (graded return, Amsterdam 2022).
--   * Physio sessions with pain 0–10: clinical, medical staff only.
--   * Exercises for home: the player and the parents see them and tick "done today".

ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS rehab_protocol text CHECK (rehab_protocol IS NULL OR rehab_protocol IN ('standard', 'concussion'));
ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS rehab_phase smallint CHECK (rehab_phase IS NULL OR rehab_phase BETWEEN 1 AND 6);
ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS rehab_phase_since date;
ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS rehab_checks jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS rehab_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- a concussed player is not cleared to play before the last phase of the graded return
CREATE OR REPLACE FUNCTION public.player_injuries_concussion_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rehab_protocol = 'concussion' AND coalesce(NEW.rehab_phase, 1) < 6
     AND (NEW.can_play OR NEW.clinical_status IN ('apto', 'condicionado', 'retorno_progressivo') OR NEW.return_date IS NOT NULL) THEN
    RAISE EXCEPTION 'Concussão: o jogador só pode voltar a jogar depois da última fase do regresso gradual.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS player_injuries_concussion_guard ON public.player_injuries;
CREATE TRIGGER player_injuries_concussion_guard BEFORE INSERT OR UPDATE ON public.player_injuries
  FOR EACH ROW EXECUTE FUNCTION public.player_injuries_concussion_guard();

-- who follows a player's recovery: staff of his team, the club's medical staff, his parents, himself
CREATE OR REPLACE FUNCTION public.can_follow_rehab(_user uuid, _player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND (
    public.can_see_injury_clinical(_user, _player)
    OR EXISTS (SELECT 1 FROM public.players p WHERE p.id = _player AND public.can_coach_team(_user, p.team_id))
    OR public.is_guardian_of_player(_user, _player)
    OR public.get_player_account_id(_user) = _player)
$$;
REVOKE ALL ON FUNCTION public.can_follow_rehab(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_follow_rehab(uuid, uuid) TO authenticated;

-- ── exercises for home ──
CREATE TABLE IF NOT EXISTS public.injury_home_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  injury_id uuid NOT NULL REFERENCES public.player_injuries(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  instructions text CHECK (instructions IS NULL OR char_length(instructions) <= 2000),
  dose text CHECK (dose IS NULL OR char_length(dose) <= 120),
  frequency text CHECK (frequency IS NULL OR char_length(frequency) <= 120),
  video_url text CHECK (video_url IS NULL OR video_url ~* '^https?://'),
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS injury_home_exercises_player_idx ON public.injury_home_exercises (player_id, active);
ALTER TABLE public.injury_home_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "home_exercises_read" ON public.injury_home_exercises;
CREATE POLICY "home_exercises_read" ON public.injury_home_exercises FOR SELECT TO authenticated
  USING (public.can_follow_rehab(auth.uid(), player_id));
DROP POLICY IF EXISTS "home_exercises_write" ON public.injury_home_exercises;
CREATE POLICY "home_exercises_write" ON public.injury_home_exercises FOR ALL TO authenticated
  USING (public.can_see_injury_clinical(auth.uid(), player_id))
  WITH CHECK (public.can_see_injury_clinical(auth.uid(), player_id));

CREATE TABLE IF NOT EXISTS public.injury_exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.injury_home_exercises(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  done_on date NOT NULL DEFAULT CURRENT_DATE,
  pain smallint CHECK (pain IS NULL OR pain BETWEEN 0 AND 10),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  logged_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, done_on)
);
ALTER TABLE public.injury_exercise_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise_logs_read" ON public.injury_exercise_logs;
CREATE POLICY "exercise_logs_read" ON public.injury_exercise_logs FOR SELECT TO authenticated
  USING (public.can_follow_rehab(auth.uid(), player_id));
DROP POLICY IF EXISTS "exercise_logs_add" ON public.injury_exercise_logs;
CREATE POLICY "exercise_logs_add" ON public.injury_exercise_logs FOR INSERT TO authenticated
  WITH CHECK (logged_by = auth.uid() AND public.can_follow_rehab(auth.uid(), player_id)
              AND EXISTS (SELECT 1 FROM public.injury_home_exercises e WHERE e.id = exercise_id AND e.player_id = injury_exercise_logs.player_id));
DROP POLICY IF EXISTS "exercise_logs_own" ON public.injury_exercise_logs;
CREATE POLICY "exercise_logs_own" ON public.injury_exercise_logs FOR UPDATE TO authenticated
  USING (logged_by = auth.uid()) WITH CHECK (logged_by = auth.uid());
DROP POLICY IF EXISTS "exercise_logs_delete" ON public.injury_exercise_logs;
CREATE POLICY "exercise_logs_delete" ON public.injury_exercise_logs FOR DELETE TO authenticated
  USING (logged_by = auth.uid() OR public.can_see_injury_clinical(auth.uid(), player_id));

-- ── physio sessions (clinical) ──
CREATE TABLE IF NOT EXISTS public.injury_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  injury_id uuid NOT NULL REFERENCES public.player_injuries(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  pain smallint CHECK (pain IS NULL OR pain BETWEEN 0 AND 10),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS injury_sessions_idx ON public.injury_sessions (injury_id, session_date);
ALTER TABLE public.injury_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "injury_sessions_clinical" ON public.injury_sessions;
CREATE POLICY "injury_sessions_clinical" ON public.injury_sessions FOR ALL TO authenticated
  USING (public.can_see_injury_clinical(auth.uid(), player_id))
  WITH CHECK (public.can_see_injury_clinical(auth.uid(), player_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.injury_home_exercises, public.injury_exercise_logs, public.injury_sessions TO authenticated;
REVOKE ALL ON public.injury_home_exercises, public.injury_exercise_logs, public.injury_sessions FROM anon;
