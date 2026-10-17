-- Medical department, part 3: prevention and the season.
--   player_growth          : height (and weight) every few months; fast growth around the growth
--                            spurt goes with Osgood-Schlatter / Sever, so the staff is warned.
--   player_medical_exams   : the sports medical exam (exame médico-desportivo), valid for a year.
--   injury_insurance_claims: reporting an injury to the sports insurance, with its deadline.
--   training_sessions.prevention_warmup : the session started with the FIFA 11+ Kids warm-up.
-- None of this is clinical: the team's staff, the club's medical staff and leadership see it,
-- parents see their own child's growth and exam.

-- who looks after a player (not clinical): his team's staff, the club's medical staff and leadership
CREATE OR REPLACE FUNCTION public.can_care_for_player(_user uuid, _player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND coalesce((
    SELECT public.can_coach_team(_user, p.team_id) OR p.owner_id = _user
           OR (t.club_id IS NOT NULL AND (public.is_medical_staff(_user, t.club_id) OR public.is_club_admin(_user, t.club_id)
                                          OR public.is_youth_coordinator(t.club_id, _user)))
      FROM public.players p LEFT JOIN public.teams t ON t.id = p.team_id WHERE p.id = _player), false)
$$;
REVOKE ALL ON FUNCTION public.can_care_for_player(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_care_for_player(uuid, uuid) TO authenticated;

-- ── growth ──
CREATE TABLE IF NOT EXISTS public.player_growth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  measured_on date NOT NULL DEFAULT CURRENT_DATE,
  height_cm numeric(5,1) NOT NULL CHECK (height_cm BETWEEN 80 AND 230),
  weight_kg numeric(5,1) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 15 AND 160),
  recorded_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, measured_on)
);
ALTER TABLE public.player_growth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "growth_read" ON public.player_growth;
CREATE POLICY "growth_read" ON public.player_growth FOR SELECT TO authenticated
  USING (public.can_care_for_player(auth.uid(), player_id) OR public.is_guardian_of_player(auth.uid(), player_id));
DROP POLICY IF EXISTS "growth_write" ON public.player_growth;
CREATE POLICY "growth_write" ON public.player_growth FOR ALL TO authenticated
  USING (public.can_care_for_player(auth.uid(), player_id))
  WITH CHECK (public.can_care_for_player(auth.uid(), player_id));

-- ── sports medical exam ──
CREATE TABLE IF NOT EXISTS public.player_medical_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  valid_until date NOT NULL,
  result text NOT NULL DEFAULT 'apto' CHECK (result IN ('apto', 'apto_condicionado', 'inapto')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  recorded_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until >= exam_date)
);
CREATE INDEX IF NOT EXISTS player_medical_exams_idx ON public.player_medical_exams (player_id, valid_until DESC);
ALTER TABLE public.player_medical_exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exams_read" ON public.player_medical_exams;
CREATE POLICY "exams_read" ON public.player_medical_exams FOR SELECT TO authenticated
  USING (public.can_care_for_player(auth.uid(), player_id) OR public.is_guardian_of_player(auth.uid(), player_id));
DROP POLICY IF EXISTS "exams_write" ON public.player_medical_exams;
CREATE POLICY "exams_write" ON public.player_medical_exams FOR ALL TO authenticated
  USING (public.can_care_for_player(auth.uid(), player_id))
  WITH CHECK (public.can_care_for_player(auth.uid(), player_id));

-- ── sports insurance ──
CREATE TABLE IF NOT EXISTS public.injury_insurance_claims (
  injury_id uuid PRIMARY KEY REFERENCES public.player_injuries(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  deadline date NOT NULL,
  submitted_on date,
  claim_number text CHECK (claim_number IS NULL OR char_length(claim_number) <= 60),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.injury_insurance_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "claims_all" ON public.injury_insurance_claims;
CREATE POLICY "claims_all" ON public.injury_insurance_claims FOR ALL TO authenticated
  USING (public.can_care_for_player(auth.uid(), player_id))
  WITH CHECK (public.can_care_for_player(auth.uid(), player_id));

-- ── injury-prevention warm-up ──
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS prevention_warmup boolean NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_growth, public.player_medical_exams, public.injury_insurance_claims TO authenticated;
REVOKE ALL ON public.player_growth, public.player_medical_exams, public.injury_insurance_claims FROM anon;
