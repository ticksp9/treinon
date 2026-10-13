-- Scouting, part 2: the game plan of a match.
-- A few key ideas for one match, tied to the opponent's sheet and to the schemes worth
-- showing the players. It is read in the match preparation and at half-time.
-- Belongs to the match: whoever coaches the team of that match works on it.

CREATE TABLE IF NOT EXISTS public.match_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES public.scout_opponents(id) ON DELETE SET NULL,
  key_points text[] NOT NULL DEFAULT '{}' CHECK (cardinality(key_points) <= 8),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  scheme_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(scheme_ids) <= 12),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_plans_opponent_idx ON public.match_plans (opponent_id);

CREATE OR REPLACE FUNCTION public.can_use_match_plan(_user uuid, _match uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND coalesce((
    SELECT m.owner_id = _user OR public.can_coach_team(_user, m.team_id)
      FROM public.matches m WHERE m.id = _match), false)
$$;
REVOKE ALL ON FUNCTION public.can_use_match_plan(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_match_plan(uuid, uuid) TO authenticated;

ALTER TABLE public.match_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_plans_all" ON public.match_plans;
CREATE POLICY "match_plans_all" ON public.match_plans FOR ALL TO authenticated
  USING (public.can_use_match_plan(auth.uid(), match_id))
  WITH CHECK (public.can_use_match_plan(auth.uid(), match_id)
              AND (opponent_id IS NULL OR public.can_use_opponent(auth.uid(), opponent_id)));

DROP TRIGGER IF EXISTS match_plans_touch ON public.match_plans;
CREATE TRIGGER match_plans_touch BEFORE UPDATE ON public.match_plans
  FOR EACH ROW EXECUTE FUNCTION public.scout_touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_plans TO authenticated;
REVOKE ALL ON public.match_plans FROM anon;
