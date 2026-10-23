-- Training dossier, phase 2 (FPF certification, criteria 4.1 and 4.2):
--   · objectives with indicator, target, deadline and how they are evaluated (team and each player)
--   · the club's guiding document (game model for 7, 9 and 11; objectives of each stage)
--   · the space each weekly training slot uses (for the FPF "mapa-tipo")
--   · the materials of each team in the season
--   · the written review of each match (what went well, what to improve)
-- Everything here is for the coaching staff: parents and players never read it.

-- ── objectives: team (player_id null) or one player ──
CREATE TABLE IF NOT EXISTS public.dossier_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  objective text NOT NULL CHECK (char_length(trim(objective)) BETWEEN 1 AND 500),
  indicator text CHECK (indicator IS NULL OR char_length(indicator) <= 500),
  target text CHECK (target IS NULL OR char_length(target) <= 300),
  deadline date,
  evaluation text CHECK (evaluation IS NULL OR char_length(evaluation) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'achieved', 'partial', 'not_achieved')),
  result text CHECK (result IS NULL OR char_length(result) <= 2000),
  sort_order integer NOT NULL DEFAULT 0,
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dossier_objectives_team_idx ON public.dossier_objectives (team_id, season_id, sort_order);
CREATE INDEX IF NOT EXISTS dossier_objectives_player_idx ON public.dossier_objectives (player_id) WHERE player_id IS NOT NULL;

-- ── the club's guiding document (one per club; a coach without a club keeps their own) ──
CREATE TABLE IF NOT EXISTS public.club_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid UNIQUE REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- { "vision": "…", "models": { "7": { "system": "…", "attack": "…", … }, "9": …, "11": …, "futsal": … },
  --   "stages": [{ "name": "…", "ages": "…", "game": "…", "motor": "…", "psych": "…", "coach": "…" }] }
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object' AND pg_column_size(content) <= 200000),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((club_id IS NULL) <> (owner_id IS NULL))
);

-- reads it: anyone who works in the club (staff, the club's coaches, the coaches of its teams)
CREATE OR REPLACE FUNCTION public.can_read_club_guidelines(_user uuid, _club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND _club IS NOT NULL AND (
    public.is_club_staff_member(_club, _user)
    OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = _club AND cc.coach_id = _user)
    OR EXISTS (SELECT 1 FROM public.team_coaches tc JOIN public.teams t ON t.id = tc.team_id WHERE t.club_id = _club AND tc.coach_id = _user)
  )
$$;
-- writes it: the club's admins and coordinators
CREATE OR REPLACE FUNCTION public.can_edit_club_guidelines(_user uuid, _club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND _club IS NOT NULL AND (
    public.is_club_admin(_user, _club)
    OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = _club AND cs.user_id = _user AND cs.is_active AND cs.role = 'coordenador')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_club_guidelines(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_club_guidelines(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_club_guidelines(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_club_guidelines(uuid, uuid) TO authenticated;

-- ── the space a weekly training slot uses ──
ALTER TABLE public.team_training_slots
  ADD COLUMN IF NOT EXISTS space text CHECK (space IS NULL OR space IN ('full', 'half', 'quarter', 'other'));

-- ── the team's materials in the season ──
ALTER TABLE public.team_season_plans
  ADD COLUMN IF NOT EXISTS materials text CHECK (materials IS NULL OR char_length(materials) <= 4000);

-- ── the written review of a match ──
CREATE TABLE IF NOT EXISTS public.match_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  positives text CHECK (positives IS NULL OR char_length(positives) <= 4000),
  improve text CHECK (improve IS NULL OR char_length(improve) <= 4000),
  next_focus text CHECK (next_focus IS NULL OR char_length(next_focus) <= 2000),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at / updated_by (only when the text really changes, so deleting an account never re-stamps it)
CREATE OR REPLACE FUNCTION public.dossier_touch_by()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR to_jsonb(NEW) - 'updated_by' - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'updated_by' - 'updated_at' THEN
    NEW.updated_at := now();
    NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS club_guidelines_touch ON public.club_guidelines;
CREATE TRIGGER club_guidelines_touch BEFORE INSERT OR UPDATE ON public.club_guidelines FOR EACH ROW EXECUTE FUNCTION public.dossier_touch_by();
DROP TRIGGER IF EXISTS match_reviews_touch ON public.match_reviews;
CREATE TRIGGER match_reviews_touch BEFORE INSERT OR UPDATE ON public.match_reviews FOR EACH ROW EXECUTE FUNCTION public.dossier_touch_by();

-- a player's objective belongs to the player's team; stamped only when something but the stamp changed
CREATE OR REPLACE FUNCTION public.dossier_objective_team()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.player_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.player_id IS DISTINCT FROM OLD.player_id OR NEW.team_id IS DISTINCT FROM OLD.team_id)
     AND NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id = NEW.player_id AND p.team_id = NEW.team_id) THEN
    RAISE EXCEPTION 'the player is not in this team' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'INSERT' OR to_jsonb(NEW) - 'updated_by' - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'updated_by' - 'updated_at' THEN
    NEW.updated_at := now();
    NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dossier_objective_team ON public.dossier_objectives;
CREATE TRIGGER dossier_objective_team BEFORE INSERT OR UPDATE ON public.dossier_objectives
  FOR EACH ROW EXECUTE FUNCTION public.dossier_objective_team();

-- ── access ──
ALTER TABLE public.dossier_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dossier_objectives_staff" ON public.dossier_objectives;
CREATE POLICY "dossier_objectives_staff" ON public.dossier_objectives FOR ALL TO authenticated
  USING (public.can_coach_team(auth.uid(), team_id)) WITH CHECK (public.can_coach_team(auth.uid(), team_id));

DROP POLICY IF EXISTS "club_guidelines_read" ON public.club_guidelines;
CREATE POLICY "club_guidelines_read" ON public.club_guidelines FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_read_club_guidelines(auth.uid(), club_id));
DROP POLICY IF EXISTS "club_guidelines_insert" ON public.club_guidelines;
CREATE POLICY "club_guidelines_insert" ON public.club_guidelines FOR INSERT TO authenticated
  WITH CHECK (CASE WHEN club_id IS NULL THEN owner_id = auth.uid() ELSE public.can_edit_club_guidelines(auth.uid(), club_id) END);
DROP POLICY IF EXISTS "club_guidelines_update" ON public.club_guidelines;
CREATE POLICY "club_guidelines_update" ON public.club_guidelines FOR UPDATE TO authenticated
  USING (CASE WHEN club_id IS NULL THEN owner_id = auth.uid() ELSE public.can_edit_club_guidelines(auth.uid(), club_id) END)
  WITH CHECK (CASE WHEN club_id IS NULL THEN owner_id = auth.uid() ELSE public.can_edit_club_guidelines(auth.uid(), club_id) END);

DROP POLICY IF EXISTS "match_reviews_staff" ON public.match_reviews;
CREATE POLICY "match_reviews_staff" ON public.match_reviews FOR ALL TO authenticated
  USING (public.can_coach_match(auth.uid(), match_id)) WITH CHECK (public.can_coach_match(auth.uid(), match_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dossier_objectives, public.match_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.club_guidelines TO authenticated;
REVOKE ALL ON public.dossier_objectives, public.match_reviews, public.club_guidelines FROM anon;
