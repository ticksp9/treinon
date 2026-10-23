-- Training dossier (FPF certification of youth academies, criterion 4.2):
-- season plan (objectives + annual periods), mesocycles, microcycles (the week), the record of each
-- training session and the coordinator's review. Everything per team and season; the team's coaching
-- staff (and the club's coordinators/admins, who already pass can_coach_team) read and write it.

-- ── season plan: objectives of the age group + the big themes of the season ──
CREATE TABLE IF NOT EXISTS public.team_season_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  objectives text CHECK (objectives IS NULL OR char_length(objectives) <= 8000),
  -- [{ "label": "Diagnóstico e bases do modelo", "from": "2026-07-01", "to": "2026-08-31", "priority": "…", "control": "Avaliação inicial" }]
  periods jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(periods) = 'array' AND jsonb_array_length(periods) <= 24 AND pg_column_size(periods) <= 30000),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, season_id)
);

-- ── mesocycles: blocks of weeks with a priority ──
CREATE TABLE IF NOT EXISTS public.training_mesocycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  kind text NOT NULL DEFAULT 'competition' CHECK (kind IN ('preparation', 'competition', 'transition')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  focus text CHECK (focus IS NULL OR char_length(focus) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS training_mesocycles_team_idx ON public.training_mesocycles (team_id, season_id, start_date);

-- ── microcycles: the week (Monday to Sunday) ──
CREATE TABLE IF NOT EXISTS public.training_microcycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
  objectives text CHECK (objectives IS NULL OR char_length(objectives) <= 4000),
  contents text CHECK (contents IS NULL OR char_length(contents) <= 8000),
  intensity text CHECK (intensity IS NULL OR intensity IN ('low', 'medium', 'high')),
  review text CHECK (review IS NULL OR char_length(review) <= 4000),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, week_start)
);

-- ── the record of a training session: what was really done, how it went, closed ──
-- (objectives / exercises / notes already exist: planned objective, contents done, observations)
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS actual_minutes integer CHECK (actual_minutes IS NULL OR actual_minutes BETWEEN 1 AND 600),
  ADD COLUMN IF NOT EXISTS session_rating smallint CHECK (session_rating IS NULL OR session_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── the coordinator's review of a team's dossier (history kept) ──
CREATE TABLE IF NOT EXISTS public.dossier_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  reviewed_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dossier_reviews_team_idx ON public.dossier_reviews (team_id, season_id, created_at DESC);

-- who supervises a team's dossier: the club's coordinators of that team and the club's admins
CREATE OR REPLACE FUNCTION public.can_review_dossier(_user uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team AND t.club_id IS NOT NULL
      AND (public.is_club_admin(_user, t.club_id) OR public.is_team_coordinator(_user, t.id))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_review_dossier(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_dossier(uuid, uuid) TO authenticated;

-- updated_at / updated_by
CREATE OR REPLACE FUNCTION public.dossier_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_season_plans', 'training_mesocycles', 'training_microcycles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.dossier_touch()', t || '_touch', t);
  END LOOP;
END $$;

-- closing a session records who and when (the app only sends closed_at)
CREATE OR REPLACE FUNCTION public.training_session_close_stamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
    NEW.closed_by := CASE WHEN NEW.closed_at IS NULL THEN NULL ELSE coalesce(auth.uid(), NEW.closed_by) END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS training_session_close_stamp ON public.training_sessions;
CREATE TRIGGER training_session_close_stamp BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.training_session_close_stamp();

-- ── access ──
ALTER TABLE public.team_season_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_mesocycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_microcycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossier_reviews ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_season_plans', 'training_mesocycles', 'training_microcycles'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_coach_team(auth.uid(), team_id)) WITH CHECK (public.can_coach_team(auth.uid(), team_id))', t || '_staff', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "dossier_reviews_read" ON public.dossier_reviews;
CREATE POLICY "dossier_reviews_read" ON public.dossier_reviews FOR SELECT TO authenticated
  USING (public.can_coach_team(auth.uid(), team_id));
DROP POLICY IF EXISTS "dossier_reviews_insert" ON public.dossier_reviews;
CREATE POLICY "dossier_reviews_insert" ON public.dossier_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewed_by = auth.uid() AND public.can_review_dossier(auth.uid(), team_id));
DROP POLICY IF EXISTS "dossier_reviews_delete" ON public.dossier_reviews;
CREATE POLICY "dossier_reviews_delete" ON public.dossier_reviews FOR DELETE TO authenticated
  USING (reviewed_by = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_season_plans, public.training_mesocycles, public.training_microcycles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.dossier_reviews TO authenticated;
REVOKE ALL ON public.team_season_plans, public.training_mesocycles, public.training_microcycles, public.dossier_reviews FROM anon;
